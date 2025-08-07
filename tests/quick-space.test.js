const axios = require('axios');

const backend_url = "http://localhost:3000";

describe("Quick Space Test", () => {
    test("Test space creation", async () => {
        // First, create and login a user
        const userSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "quickuser" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "User"
        });
        
        const userLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": userSignup.data.username,
            "password": "123456789"
        });
        
        const userToken = userLogin.data.token;
        
        try {
            console.log("Attempting to create space...");
            const response = await axios.post(backend_url + "/api/v1/space/", {
                name: "Quick Test Space",
                dimensions: "500x400"
            }, {
                headers: {
                    "Authorization": `Bearer ${userToken}`
                }
            });
            
            console.log("✅ Space creation response:", response.data);
            expect(response.status).toBe(200);
            expect(response.data.spaceId).toBeDefined();
        } catch (error) {
            console.log("❌ Space creation failed:");
            console.log("Status:", error.response?.status);
            console.log("Data:", error.response?.data);
            console.log("Error message:", error.message);
            throw error;
        }
    }, 10000); // 10 second timeout
});
