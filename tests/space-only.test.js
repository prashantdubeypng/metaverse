const axios = require('axios');

const backend_url = "http://localhost:3000";

describe("🚀 Metaverse Backend - Space Tests Only", () => {
    let userToken = "";
    let adminToken = "";
    let spaceId = "";
    let elementId = "";
    let mapId = "";

    beforeAll(async () => {
        // Create admin user
        const adminSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "admin_space_" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "Admin"
        });
        
        const adminLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": adminSignup.data.username,
            "password": "123456789"
        });
        adminToken = adminLogin.data.token;

        // Create regular user
        const userSignup = await axios.post(backend_url + "/api/v1/signup", {
            "username": "user_space_" + Math.random().toString(36).substring(7),
            "password": "123456789",
            "type": "User"
        });
        
        const userLogin = await axios.post(backend_url + "/api/v1/login", {
            "username": userSignup.data.username,
            "password": "123456789"
        });
        userToken = userLogin.data.token;

        // Create an element for space testing
        const elementResponse = await axios.post(backend_url + "/api/v1/admin/element", {
            imageurl: "https://example.com/space-element.png",
            width: "50",
            height: "50",
            static: true
        }, {
            headers: {
                "Authorization": `Bearer ${adminToken}`
            }
        });
        elementId = elementResponse.data.id;
    }, 15000);

    describe("🌌 Space Management Endpoints", () => {
        describe("POST /api/v1/space/", () => {
            test("✅ Should create space without map", async () => {
                const response = await axios.post(backend_url + "/api/v1/space/", {
                    name: "Test Space",
                    dimensions: "500x400"
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                expect(response.status).toBe(200);
                expect(response.data.spaceId).toBeDefined();
                spaceId = response.data.spaceId;
            });

            test("✅ Should create another space", async () => {
                const response = await axios.post(backend_url + "/api/v1/space/", {
                    name: "Test Space 2",
                    dimensions: "800x600"
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.spaceId).toBeDefined();
            });
        });

        describe("GET /api/v1/space/all", () => {
            test("✅ Should get all user spaces", async () => {
                const response = await axios.get(backend_url + "/api/v1/space/all", {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                expect(response.status).toBe(200);
                expect(Array.isArray(response.data.spaces)).toBe(true);
                expect(response.data.spaces.length).toBeGreaterThanOrEqual(2);
            });
        });

        describe("GET /api/v1/space/:spaceid", () => {
            test("✅ Should get space details", async () => {
                const response = await axios.get(backend_url + `/api/v1/space/${spaceId}`, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                expect(response.status).toBe(200);
                expect(response.data.dimensions).toBeDefined();
                expect(response.data.elements).toBeDefined();
            });
        });

        describe("POST /api/v1/space/element", () => {
            test("✅ Should add element to space", async () => {
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
                expect(response.status).toBe(200);
                expect(response.data.message).toContain('elemenet added into space');
            });
        });

        describe("DELETE /api/v1/space/:spaceid", () => {
            test("✅ Should delete space", async () => {
                // Create a space specifically for deletion testing
                const spaceToDeleteResp = await axios.post(backend_url + "/api/v1/space/", {
                    name: "Space to Delete",
                    dimensions: "300x300"
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                const spaceToDelete = spaceToDeleteResp.data.spaceId;

                const response = await axios.delete(backend_url + `/api/v1/space/${spaceToDelete}`, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('space deleted');
            });
        });
    });
});
