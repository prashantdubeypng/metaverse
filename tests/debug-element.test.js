const axios = require('axios');

const backend_url = "http://localhost:3000";

describe("Debug Space Element", () => {
    test("Test adding element to space", async () => {
        // First, create and login a user
        const userSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "debugelem" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "User"
        });
        
        const userLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": userSignup.data.username,
            "password": "123456789"
        });
        const userToken = userLogin.data.token;

        // Create admin for element creation
        const adminSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "debugadmin" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "Admin"
        });
        
        const adminLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": adminSignup.data.username,
            "password": "123456789"
        });
        const adminToken = adminLogin.data.token;
        
        // Create an element
        let elementId;
        try {
            const elementResponse = await axios.post(backend_url + "/api/v1/admin/element", {
                imageurl: "https://example.com/debug-element.png",
                width: "50",
                height: "50",
                static: true
            }, {
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                }
            });
            console.log("Element creation response:", elementResponse.data);
            elementId = elementResponse.data.elementId;
            console.log("Created element:", elementId);
        } catch (error) {
            console.log("Element creation failed:", error.response?.data);
            throw error;
        }
        
        // Create a space
        const spaceResponse = await axios.post(backend_url + "/api/v1/space/", {
            name: "Debug Space Element",
            dimensions: "500x400"
        }, {
            headers: {
                "Authorization": `Bearer ${userToken}`
            }
        });
        const spaceId = spaceResponse.data.spaceId;
        console.log("Created space:", spaceId);
        
        try {
            console.log("Attempting to add element to space...");
            const response = await axios.post(backend_url + "/api/v1/space/element", {
                spaceId: spaceId,
                elementId: elementId,
                x: "50",
                y: "50"
            }, {
                headers: {
                    "Authorization": `Bearer ${userToken}`
                }
            });
            
            console.log("✅ Element addition successful:", response.data);
            expect(response.status).toBe(200);
        } catch (error) {
            console.log("❌ Element addition failed:");
            console.log("Status:", error.response?.status);
            console.log("Data:", error.response?.data);
            console.log("Error message:", error.message);
            throw error;
        }
    }, 10000);
});
