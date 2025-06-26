
Below is a single Java file that combines all the necessary code for your Gatling simulation, including RSA key pair generation, DPoP token creation, and the simulation logic. This file is designed to be copied and used directly in your Gatling project. It assumes you have the required dependencies (nimbus-jose-jwt and Gatling) in your pom.xml as outlined earlier.
Save this file as ApiSimulation.java in src/test/java (or adjust the package/path as needed).
import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;
import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class ApiSimulation extends Simulation {
    private static final String BASE_URL = "https://api.example.com";
    private static final String TOKEN_ENDPOINT = "/token";
    private static final String RESOURCE_ENDPOINT = "/resource";

    // Feeder for account IDs and access tokens
    private static final FeederBuilder accountFeeder = csv("accounts.csv").random();

    // Store key pairs per account
    private static class AccountKeyStore {
        private static final Map accountKeyPairs = new HashMap<>();

        public static KeyPair getOrCreateKeyPair(String accountId) throws Exception {
            return accountKeyPairs.computeIfAbsent(accountId, k -> generateRSAKeyPair());
        }
    }

    // Generate RSA key pair
    private static class KeyPairUtil {
        public static KeyPair generateRSAKeyPair() throws Exception {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(2048); // 2048-bit RSA key
            return keyPairGenerator.generateKeyPair();
        }
    }

    // Generate DPoP proof with RS256
    private static class DPoPUtil {
        public static String generateDPoPProof(KeyPair keyPair, String htu, String htm, String accessToken) throws Exception {
            // Convert public key to JWK
            RSAKey rsaKey = new RSAKey.Builder((java.security.interfaces.RSAPublicKey) keyPair.getPublic()).build();

            // Create DPoP header
            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256)
                    .type(JOSEObjectType.JWT)
                    .jwk(rsaKey)
                    .build();

            // Create DPoP payload
            JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                    .claim("htu", Base64.getUrlEncoder().withoutPadding().encodeToString(htu.getBytes()))
                    .claim("htm", htm)
                    .claim("jti", UUID.randomUUID().toString())
                    .claim("iat", System.currentTimeMillis() / 1000);

            if (accessToken != null) {
                byte[] tokenHash = MessageDigest.getInstance("SHA-256").digest(accessToken.getBytes());
                claimsBuilder.claim("ath", Base64.getUrlEncoder().withoutPadding().encodeToString(tokenHash));
            }

            // Sign the JWT
            SignedJWT signedJWT = new SignedJWT(header, claimsBuilder.build());
            RSASSASigner signer = new RSASSASigner((java.security.interfaces.RSAPrivateKey) keyPair.getPrivate());
            signedJWT.sign(signer);

            return signedJWT.serialize();
        }
    }

    // HTTP protocol configuration
    HttpProtocolBuilder httpProtocol = http
            .baseUrl(BASE_URL)
            .acceptHeader("application/json")
            .userAgentHeader("Gatling/3.10.5");

    // Scenario
    ScenarioBuilder apiScenario = scenario("API Call Sequence")
            .feed(accountFeeder)
            .exec(session -> {
                try {
                    String accountId = session.getString("accountId");
                    KeyPair keyPair = AccountKeyStore.getOrCreateKeyPair(accountId);
                    String htu = BASE_URL + TOKEN_ENDPOINT;
                    String dpopProofToken = DPoPUtil.generateDPoPProof(keyPair, htu, "POST", null);
                    return session.set("dpopProofToken", dpopProofToken).set("keyPair", keyPair);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to generate DPoP proof for token", e);
                }
            })
            .exec(http("Token Request")
                    .post(TOKEN_ENDPOINT)
                    .header("DPoP", "#{dpopProofToken}")
                    .header("Authorization", "DPoP #{accessToken}")
                    .body(StringBody("grant_type=client_credentials"))
                    .check(status().is(200))
                    .check(jsonPath("$.access_token").saveAs("newAccessToken"))
            )
            .pause(1)
            .exec(session -> {
                try {
                    String accountId = session.getString("accountId");
                    String accessToken = session.getString("newAccessToken") != null
                            ? session.getString("newAccessToken")
                            : session.getString("accessToken");
                    KeyPair keyPair = (KeyPair) session.get("keyPair");
                    String htu = BASE_URL + RESOURCE_ENDPOINT;
                    String dpopProofResource = DPoPUtil.generateDPoPProof(keyPair, htu, "GET", accessToken);
                    return session.set("dpopProofResource", dpopProofResource);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to generate DPoP proof for resource", e);
                }
            })
            .exec(http("Resource Request")
                    .get(RESOURCE_ENDPOINT)
                    .header("DPoP", "#{dpopProofResource}")
                    .header("Authorization", "DPoP #{accessToken}")
                    .check(status().is(200))
            );

    {
        setUp(
                apiScenario.injectOpen(
                        rampUsers(100).during(60) // 100 users over 60 seconds
                )
        ).protocols(httpProtocol);
    }
}

Additional Setup
	1	Dependencies:
	◦	Ensure your pom.xml includes the required dependencies (as provided earlier):
	◦	    
	◦	        io.gatling
	◦	        gatling-core
	◦	        3.10.5
	◦	    
	◦	    
	◦	        io.gatling.highcharts
	◦	        gatling-charts-highcharts
	◦	        3.10.5
	◦	    
	◦	    
	◦	        com.nimbusds
	◦	        nimbus-jose-jwt
	◦	        9.37
	◦	    
	◦	
	◦	
	◦	
	◦	    
	◦	        
	◦	            io.gatling
	◦	            gatling-maven-plugin
	◦	            4.9.6
	◦	            
	◦	                
	◦	                    
	◦	                        test
	◦	                    
	◦	                
	◦	            
	◦	        
	◦	    
	◦	
	◦	
	2	Accounts CSV:
	◦	Create a file named accounts.csv in src/test/resources with the following content: accountId,accessToken
	◦	user1,token1
	◦	user2,token2
	◦	user3,token3
	◦	
	◦	Replace token1, token2, etc., with actual access tokens if available, or use the /token endpoint to generate them dynamically.
	3	Run the Simulation:
	◦	Compile and run the simulation using: mvn gatling:test
	◦	
	◦	Check the generated HTML report in the results directory for performance metrics.

Notes
	•	RSA Usage: The code uses RS256 (RSA with SHA-256) as per your DPoP token header. If your app should use ECDSA (e.g., ES256), replace RSA with EC, use secp256r1, and switch to ECDSASigner.
	•	htu Encoding: The htu is base64 URL-encoded to match the format in your example token (e.g., “7d1f6f8ff7da61f8b4c70ba2cd37c1122ddd16b9e1970084a60836372e0b0”).
	•	Dynamic Tokens: The simulation checks for a new access token from the /token endpoint. If your setup requires a different flow, adjust the body or check logic.
	•	Performance: Adjust rampUsers and during to simulate the desired load (e.g., 1000 users over 5 minutes).
	•	Debugging: If tokens are rejected, verify the test server accepts the generated public keys and matches the kid and n values.
Copy the entire code block above into a single file, set up the dependencies and CSV, and you’re ready to run the simulation! Let me know if you need further adjustments or encounter issues.
