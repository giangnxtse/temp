package com.example;

import io.qameta.allure.Allure;
import io.qameta.allure.AllureLifecycle;
import io.qameta.allure.model.Parameter;
import io.qameta.allure.model.TestResult;
import org.junit.platform.engine.TestDescriptor;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class AllureTestListener implements TestExecutionListener {
    private final AllureLifecycle lifecycle = Allure.getLifecycle();
    private final Map<String, TestMethodInfo> testMethodInfoMap = new HashMap<>();

    @Override
    public void executionStarted(TestIdentifier testIdentifier) {
        if (testIdentifier.isTest()) {
            try {
                // Extract method information from the test identifier
                TestDescriptor descriptor = testIdentifier.getSource()
                        .filter(source -> source instanceof org.junit.platform.engine.support.descriptor.MethodSource)
                        .map(source -> (org.junit.platform.engine.support.descriptor.MethodSource) source)
                        .orElse(null);

                if (descriptor != null) {
                    String className = descriptor.getClassName();
                    String methodName = descriptor.getMethodName();
                    Class<?> testClass = Class.forName(className);
                    Method testMethod = Arrays.stream(testClass.getDeclaredMethods())
                            .filter(m -> m.getName().equals(methodName))
                            .findFirst()
                            .orElse(null);

                    if (testMethod != null) {
                        // Collect method info
                        TestMethodInfo info = new TestMethodInfo(
                                testClass.getPackage().getName(),
                                testClass.getSimpleName(),
                                methodName,
                                testMethod.getAnnotations()
                        );

                        // Generate a unique ID for the test (Allure uses uuid)
                        String uuid = UUID.randomUUID().toString();
                        testMethodInfoMap.put(uuid, info);

                        // Start the test in Allure lifecycle
                        TestResult testResult = new TestResult()
                                .setUuid(uuid)
                                .setName(methodName)
                                .setFullName(info.packageName + "." + info.className + "." + info.methodName);
                        lifecycle.scheduleTestCase(testResult);
                        lifecycle.startTestCase(uuid);

                        // Add method info as parameters (or custom fields)
                        addMethodInfoToTestResult(uuid, info);
                    }
                }
            } catch (ClassNotFoundException e) {
                System.err.println("Failed to load test class: " + e.getMessage());
            }
        }
    }

    @Override
    public void executionFinished(TestIdentifier testIdentifier, TestExecutionResult testExecutionResult) {
        if (testIdentifier.isTest()) {
            String uuid = getUuidForTest(testIdentifier);
            if (uuid != null) {
                // Update test result status
                lifecycle.updateTestCase(uuid, result -> {
                    switch (testExecutionResult.getStatus()) {
                        case SUCCESSFUL:
                            result.setStatus(io.qameta.allure.model.Status.PASSED);
                            break;
                        case FAILED:
                            result.setStatus(io.qameta.allure.model.Status.FAILED);
                            break;
                        case ABORTED:
                            result.setStatus(io.qameta.allure.model.Status.SKIPPED);
                            break;
                    }
                });
                lifecycle.stopTestCase(uuid);
                lifecycle.writeTestCase(uuid);
            }
        }
    }

    private void addMethodInfoToTestResult(String uuid, TestMethodInfo info) {
        lifecycle.updateTestCase(uuid, result -> {
            result.getParameters().add(new Parameter().setName("packageName").setValue(info.packageName));
            result.getParameters().add(new Parameter().setName("className").setValue(info.className));
            result.getParameters().add(new Parameter().setName("methodName").setValue(info.methodName));
            
            // Add annotations
            for (Annotation annotation : info.annotations) {
                String annotationName = annotation.annotationType().getSimpleName();
                result.getParameters().add(new Parameter()
                        .setName("annotation_" + annotationName)
                        .setValue(annotation.toString()));
            }
        });
    }

    private String getUuidForTest(TestIdentifier testIdentifier) {
        return testMethodInfoMap.keySet().stream()
                .filter(uuid -> testMethodInfoMap.get(uuid).methodName.equals(testIdentifier.getDisplayName()))
                .findFirst()
                .orElse(null);
    }

    // Helper class to store test method information
    private static class TestMethodInfo {
        String packageName;
        String className;
        String methodName;
        Annotation[] annotations;

        TestMethodInfo(String packageName, String className, String methodName, Annotation[] annotations) {
            this.packageName = packageName;
            this.className = className;
            this.methodName = methodName;
            this.annotations = annotations;
        }
    }
}


package com.example;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.api.tasks.testing.Test;

public class MyAllurePlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        // Apply the Allure plugin
        project.getPlugins().apply("io.qameta.allure");

        // Configure the test task to use the custom listener
        project.getTasks().withType(Test.class).configureEach(test -> {
            test.getTestListeners().add(new AllureTestListener());
        });
    }
}
