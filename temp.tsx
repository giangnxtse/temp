// AllureResultEnricher.java
package com.example.allure;

import io.qameta.allure.model.FixtureResult;
import io.qameta.allure.model.Status;
import io.qameta.allure.model.StepResult;
import io.qameta.allure.model.TestResult;
import io.qameta.allure.listener.TestLifecycleListener;
import io.qameta.allure.Allure;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class AllureResultEnricher implements TestLifecycleListener {
    @Override
    public void beforeTestStop(TestResult result) {
        // Enrich test result with additional metadata
        enrichTestResult(result);
    }

    private void enrichTestResult(TestResult result) {
        try {
            // Find the actual test method
            Class<?> testClass = Class.forName(result.getTestCaseId());
            Method testMethod = findTestMethod(testClass, result.getName());

            if (testMethod != null) {
                // Add method and class annotations
                Map<String, String> annotations = extractAnnotations(testMethod, testClass);
                
                // Add custom data to the test result
                result.setDescriptionHtml(buildEnrichedDescription(result, annotations));
                
                // Add extra labels (these will show up in Allure report)
                result.getLabels().add(createLabel("package", testMethod.getDeclaringClass().getPackage().getName()));
                result.getLabels().add(createLabel("class", testMethod.getDeclaringClass().getSimpleName()));
                
                // Add custom parameters (these can be viewed in the Allure report)
                annotations.forEach((key, value) -> 
                    result.getParameters().add(
                        new io.qameta.allure.model.Parameter()
                            .withName(key)
                            .withValue(value)
                    )
                );
            }
        } catch (Exception e) {
            // Log or handle any errors during enrichment
            System.err.println("Error enriching Allure test result: " + e.getMessage());
        }
    }

    private Method findTestMethod(Class<?> testClass, String methodName) {
        for (Method method : testClass.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        return null;
    }

    private Map<String, String> extractAnnotations(Method method, Class<?> testClass) {
        Map<String, String> annotations = new HashMap<>();

        // Extract method annotations
        for (Annotation annotation : method.getAnnotations()) {
            annotations.put(
                "method_" + annotation.annotationType().getSimpleName(), 
                annotation.toString()
            );
        }

        // Extract class annotations
        for (Annotation annotation : testClass.getAnnotations()) {
            annotations.put(
                "class_" + annotation.annotationType().getSimpleName(), 
                annotation.toString()
            );
        }

        return annotations;
    }

    private String buildEnrichedDescription(TestResult result, Map<String, String> annotations) {
        StringBuilder descriptionBuilder = new StringBuilder();
        
        // Original description
        Optional.ofNullable(result.getDescription())
                .ifPresent(desc -> descriptionBuilder.append("<p>").append(desc).append("</p>"));
        
        // Add annotations to description
        descriptionBuilder.append("<h3>Annotations:</h3>");
        descriptionBuilder.append("<ul>");
        annotations.forEach((key, value) -> 
            descriptionBuilder.append(String.format("<li><strong>%s:</strong> %s</li>", key, value))
        );
        descriptionBuilder.append("</ul>");

        return descriptionBuilder.toString();
    }

    private io.qameta.allure.model.Label createLabel(String name, String value) {
        return new io.qameta.allure.model.Label()
            .withName(name)
            .withValue(value);
    }
}

// AllureResultEnricherExtension.java (JUnit 5 Extension)
package com.example.allure;

import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import io.qameta.allure.Allure;

public class AllureResultEnricherExtension implements BeforeEachCallback {
    @Override
    public void beforeEach(ExtensionContext context) {
        // Register the result enricher for each test
        Allure.getLifecycle().removeListeners();
        Allure.getLifecycle().registerListener(new AllureResultEnricher());
    }
}

// Example Usage in a Test Class
package com.example.tests;

import com.example.allure.AllureResultEnricherExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import io.qameta.allure.Feature;
import io.qameta.allure.Story;
import org.junit.jupiter.api.Test;

@ExtendWith(AllureResultEnricherExtension.class)
@Feature("Example Feature")
public class ExampleTest {
    @Test
    @Story("Test Scenario")
    public void testExample() {
        // Your test logic here
    }
}

// Gradle Plugin to Ensure Agent is Loaded (Optional)
// build.gradle
plugins {
    id 'java'
    id 'io.qameta.allure'
}

test {
    useJUnitPlatform()
    
    // Ensure Allure dependencies are present
    dependencies {
        implementation 'io.qameta.allure:allure-junit5:2.20.1'
    }
    
    // Optional: JVM arguments to ensure everything is set up correctly
    jvmArgs '-javaagent:path/to/aspectjweaver.jar'
}
