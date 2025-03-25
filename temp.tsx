// src/main/java/com/example/AllureEnrichPlugin.java
package com.example;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.api.tasks.testing.Test;
import io.qameta.allure.gradle.AllureExtension;

public class AllureEnrichPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        // Create extension
        project.getExtensions().create("allureEnrich", AllureEnrichExtension.class);

        // Configure after evaluation
        project.afterEvaluate(this::configureAllure);
    }

    private void configureAllure(Project project) {
        AllureExtension allureExtension = project.getExtensions().findByType(AllureExtension.class);
        if (allureExtension != null) {
            // Register custom task
            project.getTasks().register("enrichAllureResults", EnrichAllureTask.class, task -> {
                task.setGroup("Allure");
                task.setDescription("Enriches Allure results with additional metadata");
                
                task.setInputDir(project.file("${project.getBuildDir()}/allure-results"));
                task.setOutputDir(project.file("${project.getBuildDir()}/allure-results-enriched"));
                
                AllureEnrichExtension ext = project.getExtensions().getByType(AllureEnrichExtension.class);
                task.setIncludeMethodName(ext.isIncludeMethodName());
                task.setIncludeMethodAnnotations(ext.isIncludeMethodAnnotations());
                task.setIncludeClassName(ext.isIncludeClassName());
                task.setIncludeClassAnnotations(ext.isIncludeClassAnnotations());
            });

            // Hook into test tasks
            project.getTasks().withType(Test.class).configureEach(testTask -> 
                testTask.finalizedBy(project.getTasks().named("enrichAllureResults"))
            );
        }
    }
}

// src/main/java/com/example/AllureEnrichExtension.java
package com.example;

public class AllureEnrichExtension {
    private boolean includeMethodName = true;
    private boolean includeMethodAnnotations = true;
    private boolean includeClassName = true;
    private boolean includeClassAnnotations = true;

    public boolean isIncludeMethodName() { return includeMethodName; }
    public void setIncludeMethodName(boolean includeMethodName) { this.includeMethodName = includeMethodName; }
    
    public boolean isIncludeMethodAnnotations() { return includeMethodAnnotations; }
    public void setIncludeMethodAnnotations(boolean includeMethodAnnotations) { this.includeMethodAnnotations = includeMethodAnnotations; }
    
    public boolean isIncludeClassName() { return includeClassName; }
    public void setIncludeClassName(boolean includeClassName) { this.includeClassName = includeClassName; }
    
    public boolean isIncludeClassAnnotations() { return includeClassAnnotations; }
    public void setIncludeClassAnnotations(boolean includeClassAnnotations) { this.includeClassAnnotations = includeClassAnnotations; }
}

// src/main/java/com/example/EnrichAllureTask.java
package com.example;

import org.gradle.api.DefaultTask;
import org.gradle.api.tasks.*;
import io.qameta.allure.model.TestResult;
import io.qameta.allure.model.Parameter;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

@CacheableTask
public abstract class EnrichAllureTask extends DefaultTask {
    private final ObjectMapper mapper = new ObjectMapper();

    @InputDirectory
    public abstract File getInputDir();

    public abstract void setInputDir(File inputDir);

    @OutputDirectory
    public abstract File getOutputDir();

    public abstract void setOutputDir(File outputDir);

    @Input
    public abstract boolean getIncludeMethodName();

    public abstract void setIncludeMethodName(boolean include);

    @Input
    public abstract boolean getIncludeClassName();

    public abstract void setIncludeClassName(boolean include);

    @Input
    public abstract boolean getIncludeMethodAnnotations();

    public abstract void setIncludeMethodAnnotations(boolean include);

    @Input
    public abstract boolean getIncludeClassAnnotations();

    public abstract void setIncludeClassAnnotations(boolean include);

    @TaskAction
    public void enrich() throws IOException {
        if (!getInputDir().exists()) {
            getLogger().warn("Allure results directory not found: " + getInputDir());
            return;
        }

        getOutputDir().mkdirs();

        for (File file : getInputDir().listFiles()) {
            if (file.getName().endsWith(".json")) {
                TestResult result = mapper.readValue(file, TestResult.class);
                enrichTestResult(result);
                mapper.writeValue(new File(getOutputDir(), file.getName()), result);
            } else {
                Files.copy(file.toPath(), new File(getOutputDir(), file.getName()).toPath());
            }
        }
    }

    private void enrichTestResult(TestResult result) {
        List<Parameter> parameters = result.getParameters() != null 
            ? new ArrayList<>(result.getParameters()) 
            : new ArrayList<>();
        
        String fullName = result.getFullName() != null ? result.getFullName() : "";

        if (getIncludeClassName() && fullName.contains(".")) {
            String className = fullName.substring(0, fullName.lastIndexOf('.'));
            parameters.add(new Parameter().setName("Class").setValue(className));
        }

        if (getIncludeMethodName() && fullName.contains("#")) {
            String methodName = fullName.substring(fullName.lastIndexOf('#') + 1);
            parameters.add(new Parameter().setName("Method").setValue(methodName));
        }

        if (getIncludeClassAnnotations() || getIncludeMethodAnnotations()) {
            try {
                String className = fullName.substring(0, fullName.lastIndexOf('.'));
                Class<?> clazz = Class.forName(className);

                if (getIncludeClassAnnotations()) {
                    for (var annotation : clazz.getAnnotations()) {
                        parameters.add(new Parameter()
                            .setName("Class Annotation")
                            .setValue(annotation.toString()));
                    }
                }

                if (getIncludeMethodAnnotations() && fullName.contains("#")) {
                    String methodName = fullName.substring(fullName.lastIndexOf('#') + 1);
                    for (var method : clazz.getMethods()) {
                        if (method.getName().equals(methodName)) {
                            for (var annotation : method.getAnnotations()) {
                                parameters.add(new Parameter()
                                    .setName("Method Annotation")
                                    .setValue(annotation.toString()));
                            }
                            break;
                        }
                    }
                }
            } catch (ClassNotFoundException e) {
                getLogger().warn("Could not load class annotations for " + fullName + ": " + e.getMessage());
            }
        }

        result.setParameters(parameters);
    }
}
