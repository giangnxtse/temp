# Integration test setup Guidelines

## Set up structure
- Create additional elements based on this structure:
📦 Root project folder
├── 📂 jenkins/
│   └── 📂 deploy/
│       └── 📄 JenkinsFile          # Create if not exists
├── 📂 dev-setup/
│   ├── 📄 docker-compose.yaml
│   ├── 📂 zap/
│   │   ├── 📂 reports/
│   │   └── 📂 policies/
│   ├── 📂 wiremock-extensions/
│   ├── 📂 wiremock/
│   │   ├── 📂 mappings/
│   │   ├── 📂 grpc/
│   │   └── 📂 __files/
│   └── 📂 postgres/
│       └── 📄 init.sql
├── 📄 int_test.sh

- Determine service name, simply the name if its size longer than 15 characters
- in dev-setup:
    - postgres/init.sql: Create a schema based on service name
    - wiremock/__files: this folder contains response body content files for wiremock mappings
    - wiremock/grpc: this folder contains proto.dsc file for wiremock grpc mappings
    - wiremock/mappings: this folder contains wiremock mappings json file. Each downstream service should be a json file.
    - docker-compose.yaml: Docker compose configuration for all dependencies
- jenkins/deploy/JenkinsFile: create this file if not exists then enable intTestConfig:
``` 
spring_docker {
    ...other config
    intTestConfig = {
        enabled: true
    }
}
```
- 
