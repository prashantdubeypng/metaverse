const axios = require('axios');

const backend_url = "http://localhost:3000";

describe("Debug Element Deletion", () => {
    test("Test element deletion flow", async () => {
        // Create users
        const userSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "deluser" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "User"
        });
        
        const userLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": userSignup.data.username,
            "password": "123456789"
        });
        const userToken = userLogin.data.token;

        const adminSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "deladmin" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "Admin"
        });
        
        const adminLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": adminSignup.data.username,
            "password": "123456789"
        });
        const adminToken = adminLogin.data.token;
        
        // Create element
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
        const elementId = elementResponse.data.elementId;
        console.log("Created element:", elementId);
        
        // Create space
        const spaceResponse = await axios.post(backend_url + "/api/v1/space/", {
            name: "Debug Delete Space",
            dimensions: "500x400"
        }, {
            headers: {
                "Authorization": `Bearer ${userToken}`
            }
        });
        const spaceId = spaceResponse.data.spaceId;
        console.log("Created space:", spaceId);
        
        // Add element to space
        await axios.post(backend_url + "/api/v1/space/element", {
            spaceId: spaceId,
            elementId: elementId,
            x: "75",
            y: "75"
        }, {
            headers: {
                "Authorization": `Bearer ${userToken}`
            }
        });
        console.log("Added element to space");
        
        // Get space details to find the space element ID
        const spaceDetails = await axios.get(backend_url + `/api/v1/space/${spaceId}`, {
            headers: {
                "Authorization": `Bearer ${userToken}`
            }
        });
        
        console.log("Space details:", JSON.stringify(spaceDetails.data, null, 2));
        
        if (spaceDetails.data.elements.length > 0) {
            const elementToDelete = spaceDetails.data.elements[0].id;
            console.log("Element to delete ID:", elementToDelete);
            
            try {
                const deleteResponse = await axios.delete(backend_url + "/api/v1/space/element/" + elementToDelete, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                console.log("✅ Delete successful:", deleteResponse.data);
            } catch (error) {
                console.log("❌ Delete failed:");
                console.log("Status:", error.response?.status);
                console.log("Data:", error.response?.data);
            }
        } else {
            console.log("No elements found in space");
        }
    }, 15000);
});
