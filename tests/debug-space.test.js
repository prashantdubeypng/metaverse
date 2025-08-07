const axios = require('axios');

const backend_url = "http://localhost:3000";

describe("Debug Space Creation", () => {
    let userToken;
    let adminToken;

    beforeAll(async () => {
        // Create admin user
        const adminSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "admin_debug_" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "admin"
        });
        
        const adminLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": adminSignup.data.username,
            "password": "123456789"
        });
        adminToken = adminLogin.data.token;

        // Create regular user
        const userSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "user_debug_" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "user"
        });
        
        const userLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": userSignup.data.username,
            "password": "123456789"
        });
        userToken = userLogin.data.token;
    });

    test("Create space without mapId", async () => {
        try {
            const response = await axios.post(backend_url + "/api/v1/space/", {
                name: "Debug Space",
                dimensions: "500x400"
            }, {
                headers: {
                    "Authorization": `Bearer ${userToken}`
                }
            });
            
            console.log("Success response:", response.data);
            expect(response.status).toBe(200);
        } catch (error) {
            console.log("Error response:", error.response?.data || error.message);
            console.log("Error status:", error.response?.status);
            throw error;
        }
    });

    test("Create space with null mapId", async () => {
        try {
            const response = await axios.post(backend_url + "/api/v1/space/", {
                name: "Debug Space 2",
                dimensions: "500x400",
                mapId: null
            }, {
                headers: {
                    "Authorization": `Bearer ${userToken}`
                }
            });
            
            console.log("Success response:", response.data);
            expect(response.status).toBe(200);
        } catch (error) {
            console.log("Error response:", error.response?.data || error.message);
            console.log("Error status:", error.response?.status);
            throw error;
        }
    });
});
