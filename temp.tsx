import io.qameta.allure.Allure;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;

public class CustomAllureExtension implements BeforeEachCallback {
    @Override
    public void beforeEach(ExtensionContext context) throws Exception {
        Method method = context.getRequiredMethod();
        Class<?> testClass = context.getRequiredTestContainer().getTestClass();

        // Add method annotations as labels, prefixed to avoid conflicts
        for (Annotation annotation : method.getAnnotations()) {
            String key = "method_" + annotation.annotationType().getSimpleName();
            String value = annotation.toString();
            Allure.label(key, value);
        }

        // Add class annotations as labels, prefixed to avoid conflicts
        for (Annotation annotation : testClass.getAnnotations()) {
            String key = "class_" + annotation.annotationType().getSimpleName();
            String value = annotation.toString();
            Allure.label(key, value);
        }
    }
}

----------------------

import org.gradle.api.Project;
import org.gradle.api.tasks.Task;
import org.gradle.api.tasks.Test;

public class AllureSenderPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        // Create extension for configuration
        project.getExtensions().create("allureSender", AllureSenderExtension.class);

        // Configure test task to include custom extension
        project.getTasks().withType(Test.class).configureEach(testTask -> {
            testTask.getExtensions().add(new CustomAllureExtension());
        });

        // Create sendAllureResults task
        Task sendTask = project.getTasks().create("sendAllureResults", SendAllureResultsTask.class);
        sendTask.dependsOn("test");

        // Configure sendTask with serverUrl and resultsDirectory from extension
        AllureSenderExtension extension = (AllureSenderExtension) project.getExtensions().getByName("allureSender");
        sendTask.setServerUrl(extension.getServerUrl());

        // Determine results directory, fallback to default if not configured via Allure
        File resultsDirectory = extension.getResultsDirectory();
        if (project.getExtensions().findByName("allure") != null) {
            def allureExtension = project.allure
            if (allureExtension != null && allureExtension.hasProperty("report") && allureExtension.report.hasProperty("basedir")) {
                resultsDirectory = allureExtension.report.basedir
            }
        }
        sendTask.setResultsDirectory(resultsDirectory != null ? resultsDirectory : new File("build/allure-results"));
    }
}

==========================

public class AllureSenderExtension {
    private String serverUrl;
    private File resultsDirectory = new File("build/allure-results");

    public String getServerUrl() {
        return serverUrl;
    }

    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
    }

    public File getResultsDirectory() {
        return resultsDirectory;
    }

    public void setResultsDirectory(File resultsDirectory) {
        this.resultsDirectory = resultsDirectory;
    }
}

============

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import io.qameta.allure.model.TestResult;
import org.gradle.api.DefaultTask;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.TaskAction;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

public class SendAllureResultsTask extends DefaultTask {
    @Input
    private String serverUrl;

    private File resultsDirectory;

    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
    }

    public void setResultsDirectory(File resultsDirectory) {
        this.resultsDirectory = resultsDirectory;
    }

    @TaskAction
    public void sendResults() {
        if (serverUrl == null || serverUrl.isEmpty()) {
            getProject().getLogger().error("Server URL is not set.");
            return;
        }

        if (resultsDirectory == null || !resultsDirectory.exists()) {
            getProject().getLogger().error("Results directory does not exist: " + resultsDirectory);
            return;
        }

        List<File> jsonFiles = new ArrayList<>();
        for (File file : resultsDirectory.listFiles()) {
            if (file.getName().endsWith(".json")) {
                jsonFiles.add(file);
            }
        }

        if (jsonFiles.isEmpty()) {
            getProject().getLogger().info("No JSON files found in results directory.");
            return;
        }

        List<TestResult> results = new ArrayList<>();
        Gson gson = new GsonBuilder().create();
        for (File file : jsonFiles) {
            try {
                String json = new java.util.Scanner(file).useDelimiter("\\Z").next();
                TestResult result = gson.fromJson(json, TestResult.class);
                results.add(result);
            } catch (Exception e) {
                getProject().getLogger().error("Error reading file: " + file.getName(), e);
            }
        }

        String jsonToSend = gson.toJson(results);

        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(serverUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonToSend))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IOException("Server returned status code " + response.statusCode());
            }
            getProject().getLogger().info("Successfully sent data to server.");
        } catch (Exception e) {
            getProject().getLogger().error("Failed to send data to server.", e);
        }
    }
}
