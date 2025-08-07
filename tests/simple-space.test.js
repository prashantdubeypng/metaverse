const axios = require('axios');

const backend_url = "http://localhost:3000";

describe("Simple Space Test", () => {
    let userToken;
    let adminToken;

    beforeAll(async () => {
        // Create admin user
        const adminSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "admin" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "Admin"
        });
        console.log("Admin signup:", adminSignup.data);
        
        const adminLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": adminSignup.data.username,
            "password": "123456789"
        });
        adminToken = adminLogin.data.token;
        console.log("Admin token:", adminToken);

        // Create regular user
        const userSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "user" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "User"
        });
        console.log("User signup:", userSignup.data);
        
        const userLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": userSignup.data.username,
            "password": "123456789"
        });
        userToken = userLogin.data.token;
        console.log("User token:", userToken);
    });

    test("Test space creation without mapId", async () => {
        try {
            console.log("Sending space creation request...");
            const response = await axios.post(backend_url + "/api/v1/space/", {
                name: "Debug Space",
                dimensions: "500x400"
                // No mapId property at all
            }, {
                headers: {
                    "Authorization": `Bearer ${userToken}`
                }
            });
            
            console.log("✅ Space creation successful:", response.data);
            expect(response.status).toBe(200);
            expect(response.data.spaceId).toBeDefined();
        } catch (error) {
            console.log("❌ Space creation failed:");
            console.log("Status:", error.response?.status);
            console.log("Error data:", error.response?.data);
            console.log("Headers:", error.response?.headers);
            throw error;
        }
    });
});
