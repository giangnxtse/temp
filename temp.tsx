import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.testing.Test
import org.junit.platform.launcher.TestExecutionListener

buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath 'io.qameta.allure:allure-junit5:2.15.0'
        classpath 'io.qameta.allure:allure-model:2.15.0'
        classpath 'com.fasterxml.jackson.core:jackson-databind:2.13.0'
        classpath 'org.junit.platform:junit-platform-launcher:1.9.0' // Add this for Launcher API
    }
}

class AllureResultSenderPlugin implements Plugin<Project> {
    @Override
    void apply(Project project) {
        // Create the extension
        def extension = project.extensions.create("allureResultSender", AllureResultSenderExtension)

        // Ensure dependencies are available for the test task
        project.dependencies {
            testImplementation 'io.qameta.allure:allure-junit5:2.15.0'
            testImplementation 'io.qameta.allure:allure-model:2.15.0'
            testImplementation 'com.fasterxml.jackson.core:jackson-databind:2.13.0'
            testImplementation 'org.junit.platform:junit-platform-launcher:1.9.0'
        }

        project.afterEvaluate {
            // Configure all Test tasks
            project.tasks.withType(Test).configureEach { testTask ->
                // Enable Allure and JUnit Platform features
                testTask.systemProperty("junit.platform.listeners.uid.tracking.enabled", "true")
                testTask.systemProperty("allure.enabled", "true")

                // Pass the extension configuration as system properties
                testTask.systemProperty("allure.result.sender.endpoint", extension.serverEndpoint)
                testTask.systemProperty("allure.result.sender.enabled", String.valueOf(extension.enabled))

                // Hook into the test task to register the listener at runtime
                testTask.doFirst {
                    // Use reflection or a custom runner to register the listener
                    try {
                        // Instantiate the listener
                        def listener = TestResultCollector.class.newInstance()
                        listener.extension = extension // Pass extension to listener (requires field addition)

                        // Register the listener with JUnit Platform programmatically
                        def launcher = org.junit.platform.launcher.core.LauncherFactory.create()
                        launcher.registerTestExecutionListeners(listener)

                        println "Registered TestResultCollector listener at runtime"
                    } catch (Exception e) {
                        throw new GradleException("Failed to register TestResultCollector listener: ${e.message}", e)
                    }
                }
            }
        }
    }
}

class AllureResultSenderExtension {
    String serverEndpoint = "http://localhost:8080/api/test-results"
    boolean enabled = true
}

class TestResultCollector implements TestExecutionListener {
    private final SummaryGeneratingListener summaryListener = new SummaryGeneratingListener()
    private final HttpClient httpClient = HttpClient.newHttpClient()
    private final Map<String, TestResultData> testResults = new HashMap<>()
    AllureResultSenderExtension extension // Add this field to access extension at runtime

    static class TestResultData {
        String displayName
        String className
        String methodName
        TestExecutionResult.Status status
        Throwable failure
        Set<String> methodAnnotations = new HashSet<>()
        Set<String> classAnnotations = new HashSet<>()
    }

    @Override
    void executionStarted(TestIdentifier testIdentifier) {
        summaryListener.executionStarted(testIdentifier)
        if (testIdentifier.isTest()) {
            String uuid = Allure.getLifecycle().getCurrentTestCase().orElse("")
            if (!uuid.empty) {
                testResults.put(uuid, new TestResultData(
                    displayName: testIdentifier.displayName,
                    className: getClassName(testIdentifier),
                    methodName: getMethodName(testIdentifier)
                ))

                try {
                    def testSource = testIdentifier.source.orElse(null)
                    if (testSource instanceof org.junit.platform.engine.support.descriptor.MethodSource) {
                        def methodSource = testSource
                        Class<?> testClass = Class.forName(methodSource.className)
                        Method testMethod = testClass.getMethod(methodSource.methodName)

                        // Collect method annotations
                        testMethod.annotations.each { annotation ->
                            testResults[uuid].methodAnnotations.add(annotation.annotationType().simpleName)
                        }

                        // Collect class annotations
                        testClass.annotations.each { annotation ->
                            testResults[uuid].classAnnotations.add(annotation.annotationType().simpleName)
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Failed to collect annotations: " + e.message)
                }
            }
        }
    }

    @Override
    void executionFinished(TestIdentifier testIdentifier, TestExecutionResult executionResult) {
        summaryListener.executionFinished(testIdentifier, executionResult)

        if (testIdentifier.isTest()) {
            String uuid = Allure.getLifecycle().getCurrentTestCase().orElse("")
            if (!uuid.empty && testResults.containsKey(uuid)) {
                testResults[uuid].status = executionResult.status
                testResults[uuid].failure = executionResult.throwable.orElse(null)

                Optional<TestResult> allureResult = Allure.getLifecycle().getCurrentTestResult()
                if (allureResult.isPresent()) {
                    enrichAllureResult(allureResult.get(), testResults[uuid])

                    if (extension?.enabled) {
                        sendTestResultToServer(allureResult.get(), extension.serverEndpoint)
                    }
                }
            }
        }
    }

    private void enrichAllureResult(TestResult allureResult, TestResultData resultData) {
        allureResult.labels.add(new io.qameta.allure.model.Label().withName("testMethod").withValue(resultData.methodName))

        resultData.methodAnnotations.each { annotation ->
            allureResult.labels.add(new io.qameta.allure.model.Label()
                .withName("methodAnnotation")
                .withValue(annotation))
        }

        resultData.classAnnotations.each { annotation ->
            allureResult.labels.add(new io.qameta.allure.model.Label()
                .withName("classAnnotation")
                .withValue(annotation))
        }
    }

    private void sendTestResultToServer(TestResult testResult, String endpoint) {
        try {
            def objectMapper = new com.fasterxml.jackson.databind.ObjectMapper()
            String json = objectMapper.writeValueAsString(testResult)

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build()

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() >= 300) {
                System.err.println("Failed to send test result to server. Status code: ${response.statusCode}")
            }
        } catch (Exception e) {
            System.err.println("Failed to send test result to server: ${e.message}")
        }
    }

    private String getClassName(TestIdentifier testIdentifier) {
        def source = testIdentifier.source.orElse(null)
        if (source instanceof org.junit.platform.engine.support.descriptor.MethodSource) {
            return ((org.junit.platform.engine.support.descriptor.MethodSource) source).className
        }
        return null
    }

    private String getMethodName(TestIdentifier testIdentifier) {
        def source = testIdentifier.source.orElse(null)
        if (source instanceof org.junit.platform.engine.support.descriptor.MethodSource) {
            return ((org.junit.platform.engine.support.descriptor.MethodSource) source).methodName
        }
        return null
    }

    @Override
    void testPlanExecutionStarted(TestPlan testPlan) { summaryListener.testPlanExecutionStarted(testPlan) }
    @Override
    void testPlanExecutionFinished(TestPlan testPlan) { summaryListener.testPlanExecutionFinished(testPlan) }
    @Override
    void dynamicTestRegistered(TestIdentifier testIdentifier) { summaryListener.dynamicTestRegistered(testIdentifier) }
    @Override
    void executionSkipped(TestIdentifier testIdentifier, String reason) { summaryListener.executionSkipped(testIdentifier, reason) }
}

// Apply the plugin
apply plugin: AllureResultSenderPlugin
