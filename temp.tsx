plugins {
    id 'java'
    id 'maven-publish'
}

group = 'com.example'
version = '1.0.0'

repositories {
    mavenCentral()
}

dependencies {
    implementation gradleApi() // Gradle API for plugin development
    implementation 'io.qameta.allure:io.qameta.allure.gradle.plugin:2.12.0' // Allure Gradle plugin
    implementation 'io.qameta.allure:allure-junit5:2.30.0' // Allure JUnit 5 integration
    implementation 'org.junit.jupiter:junit-jupiter-api:5.10.2' // Latest JUnit API
    implementation 'org.junit.jupiter:junit-jupiter-engine:5.10.2' // Latest JUnit Engine
    implementation 'org.junit.platform:junit-platform-launcher:1.10.2' // JUnit Platform
}

publishing {
    publications {
        maven(MavenPublication) {
            from components.java
        }
    }
}

package com.example;

import io.qameta.allure.Allure;
import io.qameta.allure.AllureLifecycle;
import io.qameta.allure.model.Parameter;
import org.junit.platform.engine.TestDescriptor;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

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

                        // Store the info with a key tied to the test identifier
                        String uniqueId = testIdentifier.getUniqueId();
                        testMethodInfoMap.put(uniqueId, info);
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
            String uniqueId = testIdentifier.getUniqueId();
            TestMethodInfo info = testMethodInfoMap.get(uniqueId);

            if (info != null) {
                // Get the current Allure test result UUID
                String uuid = lifecycle.getCurrentTestCase().orElse(null);
                if (uuid != null) {
                    // Update the existing Allure test result with method info
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
            }
        }
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

        // Register the listener with the test task
        project.getTasks().withType(Test.class).configureEach(test -> {
            test.getTestListeners().add(new AllureTestListener());
        });
    }
}


