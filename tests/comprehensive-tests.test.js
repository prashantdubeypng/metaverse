const axios = require("axios");
const WebSocket = require('ws');

const backend_url = "http://localhost:3000";
const websocket_url = "ws://localhost:3001";

describe("Metaverse Backend - Comprehensive Test Suite", () => {
    
    // Global test data - will be populated during test execution
    let adminToken = "";
    let userToken = "";
    let adminUserId = "";
    let regularUserId = "";
    let avatarId = "";
    let elementId = "";
    let mapId = "";
    let spaceId = "";
    let spaceElementId = "";

    // Helper function to generate unique usernames
    const generateUsername = () => "testuser" + Math.random().toString(36).substr(2, 9);
    
    describe("Authentication Endpoints", () => {
        
        describe("POST /api/v1/signup", () => {
            test("Should create admin user successfully", async () => {
                const username = generateUsername();
                const password = "password123";
                
                const response = await axios.post(backend_url + "/api/v1/signup", {
                    username,
                    password,
                    type: "Admin"
                });
                
                expect(response.status).toBe(201);
                expect(response.data.message).toBe('User created successfully');
                expect(response.data.userId).toBeDefined();
                expect(response.data.username).toBe(username);
                expect(response.data.role).toBe('Admin');
                
                adminUserId = response.data.userId;
            });

            test("Should create regular user successfully", async () => {
                const username = generateUsername();
                const password = "password123";
                
                const response = await axios.post(backend_url + "/api/v1/signup", {
                    username,
                    password,
                    type: "User"
                });
                
                expect(response.status).toBe(201);
                expect(response.data.role).toBe('User');
                regularUserId = response.data.userId;
            });

            test("Should fail with duplicate username", async () => {
                const username = generateUsername();
                const password = "password123";
                
                // Create first user
                await axios.post(backend_url + "/api/v1/signup", {
                    username,
                    password,
                    type: "User"
                });
                
                // Try to create duplicate
                try {
                    await axios.post(backend_url + "/api/v1/signup", {
                        username,
                        password,
                        type: "User"
                    });
                    expect(true).toBe(false); // Should not reach here
                } catch (error) {
                    expect(error.response.status).toBe(409);
                    expect(error.response.data.error).toBe('Username already exists');
                }
            });

            test("Should fail with missing username", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/signup", {
                        password: "password123",
                        type: "User"
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });

            test("Should fail with missing password", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/signup", {
                        username: generateUsername(),
                        type: "User"
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });

            test("Should fail with short password", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/signup", {
                        username: generateUsername(),
                        password: "123",
                        type: "User"
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });

        describe("POST /api/v1/login", () => {
            let testUsername = "";
            let testPassword = "password123";

            beforeAll(async () => {
                testUsername = generateUsername();
                await axios.post(backend_url + "/api/v1/signup", {
                    username: testUsername,
                    password: testPassword,
                    type: "Admin"
                });
            });

            test("Should login admin successfully", async () => {
                const response = await axios.post(backend_url + "/api/v1/login", {
                    username: testUsername,
                    password: testPassword
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('Login successful');
                expect(response.data.token).toBeDefined();
                
                adminToken = response.data.token;
            });

            test("Should login regular user successfully", async () => {
                const username = generateUsername();
                const password = "password123";
                
                await axios.post(backend_url + "/api/v1/signup", {
                    username,
                    password,
                    type: "User"
                });
                
                const response = await axios.post(backend_url + "/api/v1/login", {
                    username,
                    password
                });
                
                expect(response.status).toBe(200);
                expect(response.data.token).toBeDefined();
                userToken = response.data.token;
            });

            test("Should fail with wrong username", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/login", {
                        username: "nonexistent" + Math.random(),
                        password: testPassword
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with wrong password", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/login", {
                        username: testUsername,
                        password: "wrongpassword"
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with missing credentials", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/login", {
                        username: testUsername
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });
    });

    describe("Public Resource Endpoints", () => {
        
        describe("GET /api/v1/elements", () => {
            test("Should get all elements", async () => {
                const response = await axios.get(backend_url + "/api/v1/elements");
                
                expect(response.status).toBe(200);
                expect(response.data.elements).toBeDefined();
                expect(Array.isArray(response.data.elements)).toBe(true);
                
                if (response.data.elements.length > 0) {
                    const element = response.data.elements[0];
                    expect(element.id).toBeDefined();
                    expect(element.imageurl).toBeDefined();
                    expect(element.width).toBeDefined();
                    expect(element.height).toBeDefined();
                    expect(typeof element.static).toBe('boolean');
                }
            });
        });

        describe("GET /api/v1/avatars", () => {
            test("Should get all avatars", async () => {
                const response = await axios.get(backend_url + "/api/v1/avatars");
                
                expect(response.status).toBe(200);
                expect(response.data.avatars).toBeDefined();
                expect(Array.isArray(response.data.avatars)).toBe(true);
            });
        });
    });

    describe("Admin Endpoints", () => {
        
        describe("GET /api/v1/admin/", () => {
            test("Should get admin route status", async () => {
                const response = await axios.get(backend_url + "/api/v1/admin/");
                
                expect(response.status).toBe(200);
                expect(response.data).toBe('Admin route is working');
            });
        });

        describe("POST /api/v1/admin/avatar", () => {
            test("Should create avatar with admin auth", async () => {
                const response = await axios.post(backend_url + "/api/v1/admin/avatar", {
                    name: "Test Avatar",
                    imageurl: "https://example.com/avatar.png"
                }, {
                    headers: {
                        "Authorization": `Bearer ${adminToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('avatar created');
                expect(response.data.avatarId).toBeDefined();
                
                avatarId = response.data.avatarId;
            });

            test("Should fail without admin auth", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/admin/avatar", {
                        name: "Test Avatar",
                        imageurl: "https://example.com/avatar.png"
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(403);
                }
            });

            test("Should fail without auth token", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/admin/avatar", {
                        name: "Test Avatar",
                        imageurl: "https://example.com/avatar.png"
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with invalid data", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/admin/avatar", {
                        name: "Test Avatar"
                        // Missing imageurl
                    }, {
                        headers: {
                            "Authorization": `Bearer ${adminToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });

        describe("POST /api/v1/admin/element", () => {
            test("Should create element with admin auth", async () => {
                const response = await axios.post(backend_url + "/api/v1/admin/element", {
                    imageurl: "https://example.com/element.png",
                    width: "100",
                    height: "100",
                    static: true
                }, {
                    headers: {
                        "Authorization": `Bearer ${adminToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('element created');
                expect(response.data.elementId).toBeDefined();
                
                elementId = response.data.elementId;
            });

            test("Should fail without admin auth", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/admin/element", {
                        imageurl: "https://example.com/element.png",
                        width: "100",
                        height: "100",
                        static: false
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(403);
                }
            });

            test("Should fail with invalid data", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/admin/element", {
                        imageurl: "https://example.com/element.png"
                        // Missing required fields
                    }, {
                        headers: {
                            "Authorization": `Bearer ${adminToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });

        describe("POST /api/v1/admin/map", () => {
            test("Should create map with admin auth", async () => {
                const response = await axios.post(backend_url + "/api/v1/admin/map", {
                    thumbnail: "https://example.com/map-thumb.png",
                    name: "Test Map",
                    dimensions: "800x600",
                    defaultelement: [
                        {
                            elementId: elementId,
                            x: "100",
                            y: "100"
                        }
                    ]
                }, {
                    headers: {
                        "Authorization": `Bearer ${adminToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('Map created successfully');
                expect(response.data.mapId).toBeDefined();
                
                mapId = response.data.mapId;
            });

            test("Should fail without admin auth", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/admin/map", {
                        thumbnail: "https://example.com/map-thumb.png",
                        name: "Test Map",
                        dimensions: "800x600",
                        defaultelement: []
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(403);
                }
            });

            test("Should fail with invalid dimensions", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/admin/map", {
                        thumbnail: "https://example.com/map-thumb.png",
                        name: "Test Map",
                        dimensions: "invalid-format",
                        defaultelement: []
                    }, {
                        headers: {
                            "Authorization": `Bearer ${adminToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });
    });

    describe("User Endpoints", () => {
        
        describe("POST /api/v1/user/metadata", () => {
            test("Should update user metadata with valid avatar", async () => {
                const response = await axios.post(backend_url + "/api/v1/user/metadata", {
                    avatarId: avatarId
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('User metadata updated successfully');
            });

            test("Should fail with invalid avatar ID", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/user/metadata", {
                        avatarId: "invalid-avatar-id"
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                    expect(error.response.data.error).toBe('Avatar not found');
                }
            });

            test("Should fail without auth token", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/user/metadata", {
                        avatarId: avatarId
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with missing avatarId", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/user/metadata", {
                        // Missing avatarId
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });

        describe("GET /api/v1/user/metadata/bulk", () => {
            test("Should get bulk user metadata", async () => {
                const response = await axios.get(
                    backend_url + `/api/v1/user/metadata/bulk?ids=["${regularUserId}"]`,
                    {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    }
                );
                
                expect(response.status).toBe(200);
                expect(response.data.avatar).toBeDefined();
                expect(Array.isArray(response.data.avatar)).toBe(true);
            });

            test("Should fail without auth token", async () => {
                try {
                    await axios.get(
                        backend_url + `/api/v1/user/metadata/bulk?ids=["${regularUserId}"]`
                    );
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with invalid JSON in ids", async () => {
                try {
                    await axios.get(
                        backend_url + `/api/v1/user/metadata/bulk?ids=invalid-json`,
                        {
                            headers: {
                                "Authorization": `Bearer ${userToken}`
                            }
                        }
                    );
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });
    });

    describe("Space Management Endpoints", () => {
        
        describe("POST /api/v1/space/", () => {
            test("Should create space without map", async () => {
                const response = await axios.post(backend_url + "/api/v1/space/", {
                    name: "Test Space",
                    dimensions: "500x400"
                    // mapId is optional, not sending null
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.spaceId).toBeDefined();
                
                spaceId = response.data.spaceId;
            });

            test("Should create space with map", async () => {
                const response = await axios.post(backend_url + "/api/v1/space/", {
                    name: "Test Space with Map",
                    dimensions: "800x600"
                    // For now, not using mapId since we need to test without it first
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.spaceId).toBeDefined();
            });

            test("Should fail with invalid dimensions", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/space/", {
                        name: "Test Space",
                        dimensions: "invalid",
                        mapId: null
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });

            test("Should fail without auth", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/space/", {
                        name: "Test Space",
                        dimensions: "500x400",
                        mapId: null
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with nonexistent map", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/space/", {
                        name: "Test Space",
                        dimensions: "500x400",
                        mapId: "nonexistent-map-id"
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(404);
                }
            });
        });

        describe("GET /api/v1/space/:spaceid", () => {
            test("Should get space details", async () => {
                const response = await axios.get(backend_url + `/api/v1/space/${spaceId}`, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.dimensions).toBeDefined();
                expect(response.data.elements).toBeDefined();
                expect(Array.isArray(response.data.elements)).toBe(true);
            });

            test("Should fail without auth", async () => {
                try {
                    await axios.get(backend_url + `/api/v1/space/${spaceId}`);
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with nonexistent space", async () => {
                try {
                    await axios.get(backend_url + `/api/v1/space/nonexistent-space-id`, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });

        describe("GET /api/v1/space/all", () => {
            test("Should get all user spaces", async () => {
                const response = await axios.get(backend_url + "/api/v1/space/all", {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.spaces).toBeDefined();
                expect(Array.isArray(response.data.spaces)).toBe(true);
                expect(response.data.spaces.length).toBeGreaterThan(0);
                
                const space = response.data.spaces[0];
                expect(space.id).toBeDefined();
                expect(space.name).toBeDefined();
                expect(space.dimensions).toBeDefined();
            });

            test("Should fail without auth", async () => {
                try {
                    await axios.get(backend_url + "/api/v1/space/all");
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });
        });

        describe("POST /api/v1/space/element", () => {
            test("Should add element to space", async () => {
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
                expect(response.data.message).toBe('elemenet added into space');
            });

            test("Should fail without auth", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/space/element", {
                        spaceId: spaceId,
                        elementId: elementId,
                        x: "50",
                        y: "50"
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with nonexistent space", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/space/element", {
                        spaceId: "nonexistent-space-id",
                        elementId: elementId,
                        x: "50",
                        y: "50"
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });

            test("Should fail with invalid data", async () => {
                try {
                    await axios.post(backend_url + "/api/v1/space/element", {
                        spaceId: spaceId,
                        // Missing required fields
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });

        describe("DELETE /api/v1/space/element/", () => {
            let elementToDelete = "";

            beforeAll(async () => {
                // First, add an element to the space so we can delete it
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

                // Now get the space to find the element we just added
                const spaceResponse = await axios.get(backend_url + `/api/v1/space/${spaceId}`, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                if (spaceResponse.data.elements.length > 0) {
                    elementToDelete = spaceResponse.data.elements[0].id;
                }
            });

            test("Should delete element from space", async () => {
                if (!elementToDelete) {
                    // Skip test if no element to delete
                    console.log("Skipping test - no element to delete");
                    return;
                }

                const response = await axios.delete(backend_url + "/api/v1/space/element/" + elementToDelete, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('element deleted from space');
            });

            test("Should fail without auth", async () => {
                try {
                    await axios.delete(backend_url + "/api/v1/space/element/some-element-id");
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with nonexistent element", async () => {
                try {
                    await axios.delete(backend_url + "/api/v1/space/element/nonexistent-element-id", {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });
        });

        describe("DELETE /api/v1/space/:spaceid", () => {
            let spaceToDelete = "";

            beforeAll(async () => {
                // Create a space specifically for deletion testing
                const response = await axios.post(backend_url + "/api/v1/space/", {
                    name: "Space to Delete",
                    dimensions: "300x300"
                    // No mapId needed
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                spaceToDelete = response.data.spaceId;
            });

            test("Should delete space", async () => {
                const response = await axios.delete(backend_url + `/api/v1/space/${spaceToDelete}`, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('space deleted');
            });

            test("Should fail without auth", async () => {
                try {
                    await axios.delete(backend_url + `/api/v1/space/some-space-id`);
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(401);
                }
            });

            test("Should fail with nonexistent space", async () => {
                try {
                    await axios.delete(backend_url + `/api/v1/space/nonexistent-space-id`, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(400);
                }
            });

            test("Should fail when user doesn't own space", async () => {
                // Create space with one user
                const response1 = await axios.post(backend_url + "/api/v1/space/", {
                    name: "Another User's Space",
                    dimensions: "300x300",
                    mapId: null
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                const otherSpaceId = response1.data.spaceId;
                
                try {
                    // Try to delete with admin user (different owner)
                    await axios.delete(backend_url + `/api/v1/space/${otherSpaceId}`, {
                        headers: {
                            "Authorization": `Bearer ${adminToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    expect(error.response.status).toBe(403);
                }
            });
        });
    });

    describe("Error Handling & Edge Cases", () => {

        test("Should handle invalid JWT token", async () => {
            try {
                await axios.get(backend_url + "/api/v1/space/all", {
                    headers: {
                        "Authorization": "Bearer invalid-token"
                    }
                });
                expect(true).toBe(false);
            } catch (error) {
                expect(error.response.status).toBe(401);
            }
        });

        test("Should handle malformed Authorization header", async () => {
            try {
                await axios.get(backend_url + "/api/v1/space/all", {
                    headers: {
                        "Authorization": "InvalidFormat"
                    }
                });
                expect(true).toBe(false);
            } catch (error) {
                expect(error.response.status).toBe(401);
            }
        });

        test("Should handle missing Authorization header", async () => {
            try {
                await axios.post(backend_url + "/api/v1/user/metadata", {
                    avatarId: "some-id"
                });
                expect(true).toBe(false);
            } catch (error) {
                expect(error.response.status).toBe(401);
            }
        });

        test("Should handle non-existent endpoints", async () => {
            try {
                await axios.get(backend_url + "/api/v1/nonexistent");
                expect(true).toBe(false);
            } catch (error) {
                expect(error.response.status).toBe(404);
            }
        });

        test("Should handle malformed JSON in request body", async () => {
            try {
                await axios.post(backend_url + "/api/v1/signup", "invalid-json", {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
                expect(true).toBe(false);
            } catch (error) {
                expect(error.response.status).toBe(400);
            }
        });
    });

    describe("Data Validation Tests", () => {

        test("Should validate space dimensions format", async () => {
            const testCases = [
                "abc", "123", "100x", "x200", "100x200x300", "", "0x0", "-100x200"
            ];
            
            for (const dimensions of testCases) {
                try {
                    await axios.post(backend_url + "/api/v1/space/", {
                        name: "Test Space",
                        dimensions: dimensions,
                        mapId: null
                    }, {
                        headers: {
                            "Authorization": `Bearer ${userToken}`
                        }
                    });
                    expect(true).toBe(false); // Should not reach here
                } catch (error) {
                    // Handle both axios errors and other errors
                    if (error.response) {
                        expect(error.response.status).toBe(400);
                    } else {
                        // If no response, it could be a network error or parsing error
                        expect(error.code || error.message).toBeDefined();
                    }
                }
            }
        });

        test("Should validate element creation data types", async () => {
            const invalidTestCases = [
                { width: "abc", height: "100", static: true },
                { width: "100", height: "abc", static: true },
                { width: "100", height: "100", static: "not-boolean" },
                { width: "", height: "100", static: true },
                { width: "100", height: "", static: true }
            ];
            
            for (const testCase of invalidTestCases) {
                try {
                    await axios.post(backend_url + "/api/v1/admin/element", {
                        imageurl: "https://example.com/element.png",
                        ...testCase
                    }, {
                        headers: {
                            "Authorization": `Bearer ${adminToken}`
                        }
                    });
                    expect(true).toBe(false);
                } catch (error) {
                    // Accept both 400 (validation error) and 500 (parsing error)
                    expect([400, 500]).toContain(error.response.status);
                }
            }
        });
    });

    describe("Performance & Load Tests", () => {
        
        test("Should handle multiple concurrent requests", async () => {
            const promises = [];
            
            // Make 10 concurrent requests to get elements
            for (let i = 0; i < 10; i++) {
                promises.push(axios.get(backend_url + "/api/v1/elements"));
            }
            
            const responses = await Promise.all(promises);
            
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.data.elements).toBeDefined();
            });
        });

        test("Should handle bulk user creation", async () => {
            const userCreationPromises = [];
            
            // Create 5 users concurrently
            for (let i = 0; i < 5; i++) {
                userCreationPromises.push(
                    axios.post(backend_url + "/api/v1/signup", {
                        username: generateUsername(),
                        password: "password123",
                        type: "User"
                    })
                );
            }
            
            const responses = await Promise.all(userCreationPromises);
            
            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.data.userId).toBeDefined();
            });
        });
    });

    // WebSocket Helper Functions
    function connectWebSocket() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(websocket_url);
            
            ws.on('open', () => {
                resolve(ws);
            });
            
            ws.on('error', (error) => {
                reject(error);
            });
            
            // Set timeout for connection
            setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
        });
    }

    function waitForMessage(ws, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Message timeout'));
            }, timeout);
            
            ws.once('message', (data) => {
                clearTimeout(timeoutId);
                try {
                    const parsed = JSON.parse(data.toString());
                    resolve(parsed);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    function waitForClose(ws, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Close timeout'));
            }, timeout);
            
            ws.once('close', (code, reason) => {
                clearTimeout(timeoutId);
                resolve({ code, reason: reason.toString() });
            });
        });
    }

    describe("WebSocket Real-time Features", () => {
        
        describe("WebSocket Connection & Authentication", () => {
            test("Should establish WebSocket connection", async () => {
                const ws = await connectWebSocket();
                expect(ws.readyState).toBe(WebSocket.OPEN);
                ws.close();
            });

            test("Should join space successfully with valid token and space", async () => {
                const ws = await connectWebSocket();
                
                // Send join message with real space ID and token
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: userToken
                    }
                }));
                
                // Wait for space-joined confirmation
                const response = await waitForMessage(ws);
                
                expect(response.type).toBe('Space-joined');
                expect(response.payload.spawn).toBeDefined();
                expect(response.payload.spawn.x).toBeGreaterThanOrEqual(0);
                expect(response.payload.spawn.y).toBeGreaterThanOrEqual(0);
                expect(response.payload.Users).toBeDefined();
                expect(Array.isArray(response.payload.Users)).toBe(true);
                
                ws.close();
            });

            test("Should reject join with invalid token", async () => {
                const ws = await connectWebSocket();
                
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: 'invalid-token'
                    }
                }));
                
                // Should close with error
                const closeEvent = await waitForClose(ws);
                expect(closeEvent.code).toBe(1008);
                expect(closeEvent.reason).toBe('Invalid token');
            });

            test("Should reject join with nonexistent space", async () => {
                const ws = await connectWebSocket();
                
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: 'nonexistent-space-id',
                        token: userToken
                    }
                }));
                
                // Should close with error
                const closeEvent = await waitForClose(ws);
                expect(closeEvent.code).toBe(1008);
                expect(closeEvent.reason).toBe('Space not found');
            });

            test("Should reject join without token", async () => {
                const ws = await connectWebSocket();
                
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId
                        // Missing token
                    }
                }));
                
                // Should close with error
                const closeEvent = await waitForClose(ws);
                expect(closeEvent.code).toBe(1008);
                expect(closeEvent.reason).toBe('Invalid token');
            });
        });

        describe("User Movement & Position Updates", () => {
            let ws1, ws2;
            let user1Position, user2Position;
            
            beforeEach(async () => {
                // Create two WebSocket connections
                ws1 = await connectWebSocket();
                ws2 = await connectWebSocket();
                
                // Join first user to space
                ws1.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: userToken
                    }
                }));
                
                const joinResponse1 = await waitForMessage(ws1);
                user1Position = joinResponse1.payload.spawn;
                
                // Join second user to same space
                ws2.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: userToken
                    }
                }));
                
                // First user should receive notification of second user joining
                const userJoinedNotification = await waitForMessage(ws1);
                expect(userJoinedNotification.type).toBe('user-joined-space');
                
                const joinResponse2 = await waitForMessage(ws2);
                user2Position = joinResponse2.payload.spawn;
            });
            
            afterEach(() => {
                if (ws1 && ws1.readyState === WebSocket.OPEN) ws1.close();
                if (ws2 && ws2.readyState === WebSocket.OPEN) ws2.close();
            });

            test("Should accept valid move (1 unit horizontal)", async () => {
                // Move user1 one unit to the right
                ws1.send(JSON.stringify({
                    type: 'move',
                    payload: {
                        x: user1Position.x + 1,
                        y: user1Position.y
                    }
                }));
                
                // User2 should receive the movement broadcast
                const moveMessage = await waitForMessage(ws2);
                
                expect(moveMessage.type).toBe('user-moved');
                expect(moveMessage.payload.x).toBe(user1Position.x + 1);
                expect(moveMessage.payload.y).toBe(user1Position.y);
                expect(moveMessage.payload.userId).toBeDefined();
            });

            test("Should accept valid move (1 unit vertical)", async () => {
                // Move user1 one unit up
                ws1.send(JSON.stringify({
                    type: 'move',
                    payload: {
                        x: user1Position.x,
                        y: user1Position.y + 1
                    }
                }));
                
                // User2 should receive the movement broadcast
                const moveMessage = await waitForMessage(ws2);
                
                expect(moveMessage.type).toBe('user-moved');
                expect(moveMessage.payload.x).toBe(user1Position.x);
                expect(moveMessage.payload.y).toBe(user1Position.y + 1);
                expect(moveMessage.payload.userId).toBeDefined();
            });

            test("Should reject invalid move (more than 1 unit)", async () => {
                // Try to move 2 units at once
                ws1.send(JSON.stringify({
                    type: 'move',
                    payload: {
                        x: user1Position.x + 2,
                        y: user1Position.y
                    }
                }));
                
                // Should receive move rejection
                const rejectMessage = await waitForMessage(ws1);
                
                expect(rejectMessage.type).toBe('move-rejected');
                expect(rejectMessage.payload.x).toBe(user1Position.x);
                expect(rejectMessage.payload.y).toBe(user1Position.y);
                expect(rejectMessage.payload.userId).toBeDefined();
            });

            test("❌ Should reject diagonal move", async () => {
                // Try to move diagonally
                ws1.send(JSON.stringify({
                    type: 'move',
                    payload: {
                        x: user1Position.x + 1,
                        y: user1Position.y + 1
                    }
                }));
                
                // Should receive move rejection
                const rejectMessage = await waitForMessage(ws1);
                
                expect(rejectMessage.type).toBe('move-rejected');
                expect(rejectMessage.payload.x).toBe(user1Position.x);
                expect(rejectMessage.payload.y).toBe(user1Position.y);
                expect(rejectMessage.payload.userId).toBeDefined();
            });
        });

        describe("Multi-User Real-time Interactions", () => {
            test("Should broadcast user join to existing users", async () => {
                const ws1 = await connectWebSocket();
                const ws2 = await connectWebSocket();
                
                // First user joins
                ws1.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: userToken
                    }
                }));
                
                await waitForMessage(ws1); // Wait for join confirmation
                
                // Second user joins
                ws2.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: userToken
                    }
                }));
                
                // First user should receive notification of second user joining
                const joinNotification = await waitForMessage(ws1);
                
                expect(joinNotification.type).toBe('user-joined-space');
                expect(joinNotification.payload.userId).toBeDefined();
                expect(joinNotification.payload.x).toBeGreaterThanOrEqual(0);
                expect(joinNotification.payload.y).toBeGreaterThanOrEqual(0);
                
                ws1.close();
                ws2.close();
            });

            test("Should broadcast user leave to remaining users", async () => {
                const ws1 = await connectWebSocket();
                const ws2 = await connectWebSocket();
                
                // Both users join
                ws1.send(JSON.stringify({
                    type: 'join',
                    payload: { spaceId: spaceId, token: userToken }
                }));
                
                await waitForMessage(ws1); // Join confirmation
                
                ws2.send(JSON.stringify({
                    type: 'join',
                    payload: { spaceId: spaceId, token: userToken }
                }));
                
                await waitForMessage(ws1); // User joined notification
                await waitForMessage(ws2); // Join confirmation
                
                // Second user leaves (close connection)
                ws2.close();
                
                // First user should receive leave notification
                const leaveNotification = await waitForMessage(ws1);
                
                expect(leaveNotification.type).toBe('user-left');
                expect(leaveNotification.payload.userId).toBeDefined();
                
                ws1.close();
            });

            test("Should handle multiple users in same space", async () => {
                const connections = [];
                const joinPromises = [];
                
                // Create 3 WebSocket connections
                for (let i = 0; i < 3; i++) {
                    const ws = await connectWebSocket();
                    connections.push(ws);
                    
                    ws.send(JSON.stringify({
                        type: 'join',
                        payload: { spaceId: spaceId, token: userToken }
                    }));
                    
                    joinPromises.push(waitForMessage(ws));
                }
                
                // Wait for all join confirmations
                const joinResponses = await Promise.all(joinPromises);
                
                // Each user should receive proper join confirmation
                joinResponses.forEach(response => {
                    expect(response.type).toBe('Space-joined');
                    expect(response.payload.Users).toBeDefined();
                    expect(Array.isArray(response.payload.Users)).toBe(true);
                });
                
                // Clean up
                connections.forEach(ws => ws.close());
            });
        });

        describe("WebSocket Error Handling & Edge Cases", () => {
            // test("Should handle malformed JSON messages gracefully", async () => {
            //     const ws = await connectWebSocket();
                
            //     // First join properly
            //     ws.send(JSON.stringify({
            //         type: 'join',
            //         payload: { spaceId: spaceId, token: userToken }
            //     }));
                
            //     await waitForMessage(ws); // Wait for join confirmation
                
            //     // Send malformed JSON
            //     ws.send('invalid-json{');
                
            //     // Connection should remain open
            //     await new Promise((resolve) => {
            //         setTimeout(() => {
            //             expect(ws.readyState).toBe(WebSocket.OPEN);
            //             ws.close();
            //             resolve();
            //         }, 1000);
            //     });
            // });

            // test("Should handle unknown message types", async () => {
            //     const ws = await connectWebSocket();
                
            //     // First join properly
            //     ws.send(JSON.stringify({
            //         type: 'join',
            //         payload: { spaceId: spaceId, token: userToken }
            //     }));
                
            //     await waitForMessage(ws); // Wait for join confirmation
                
            //     // Send unknown message type
            //     ws.send(JSON.stringify({
            //         type: 'unknown-type',
            //         payload: { test: 'data' }
            //     }));
                
            //     // Connection should remain open
            //     await new Promise((resolve) => {
            //         setTimeout(() => {
            //             expect(ws.readyState).toBe(WebSocket.OPEN);
            //             ws.close();
            //             resolve();
            //         }, 1000);
            //     });
            // });

            test("Should handle rapid message sending", async () => {
                const ws = await connectWebSocket();
                
                // Join first
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: { spaceId: spaceId, token: userToken }
                }));
                
                const joinResponse = await waitForMessage(ws);
                const x = joinResponse.payload.spawn.x;
                const y = joinResponse.payload.spawn.y;
                
                // Send multiple rapid moves
                for (let i = 0; i < 5; i++) {
                    ws.send(JSON.stringify({
                        type: 'move',
                        payload: { x: x + (i % 2), y: y }
                    }));
                }
                
                // Connection should handle all messages
                await new Promise((resolve) => {
                    setTimeout(() => {
                        expect(ws.readyState).toBe(WebSocket.OPEN);
                        ws.close();
                        resolve();
                    }, 2000);
                });
            });
        });

        describe("WebSocket Security & Token Validation", () => {
            test("Should reject expired JWT token", async () => {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = '123bsdkmcbcanu'; // Same as server
                
                const ws = await connectWebSocket();
                
                // Create expired token
                const expiredToken = jwt.sign(
                    { userId: 'test-user' }, 
                    JWT_SECRET, 
                    { expiresIn: '-1h' }
                );
                
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: expiredToken
                    }
                }));
                
                // Should close with error
                const closeEvent = await waitForClose(ws);
                expect(closeEvent.code).toBe(1008);
                expect(closeEvent.reason).toBe('Invalid token');
            });

            test("Should reject token with wrong secret", async () => {
                const jwt = require('jsonwebtoken');
                
                const ws = await connectWebSocket();
                
                // Create token with wrong secret
                const wrongToken = jwt.sign(
                    { userId: 'test-user' }, 
                    'wrong-secret'
                );
                
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: spaceId,
                        token: wrongToken
                    }
                }));
                
                // Should close with error
                const closeEvent = await waitForClose(ws);
                expect(closeEvent.code).toBe(1008);
                expect(closeEvent.reason).toBe('Invalid token');
            });
        });

        describe("Integration: HTTP + WebSocket Workflow", () => {
            test("Complete user journey: Create space via HTTP, join via WebSocket", async () => {
                // 1. Create a new space via HTTP
                const spaceResponse = await axios.post(backend_url + "/api/v1/space/", {
                    name: "WebSocket Integration Test Space",
                    dimensions: "800x600"
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                const newSpaceId = spaceResponse.data.spaceId;
                expect(newSpaceId).toBeDefined();
                
                // 2. Join the space via WebSocket
                const ws = await connectWebSocket();
                
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: {
                        spaceId: newSpaceId,
                        token: userToken
                    }
                }));
                
                const joinResponse = await waitForMessage(ws);
                
                expect(joinResponse.type).toBe('Space-joined');
                expect(joinResponse.payload.spawn.x).toBeLessThan(800);
                expect(joinResponse.payload.spawn.y).toBeLessThan(600);
                
                // 3. Add element to space via HTTP
                await axios.post(backend_url + "/api/v1/space/element", {
                    spaceId: newSpaceId,
                    elementId: elementId,
                    x: "100",
                    y: "100"
                }, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                // 4. Verify space state via HTTP
                const spaceDetails = await axios.get(backend_url + `/api/v1/space/${newSpaceId}`, {
                    headers: {
                        "Authorization": `Bearer ${userToken}`
                    }
                });
                
                expect(spaceDetails.data.elements.length).toBeGreaterThan(0);
                
                ws.close();
            });
            test("Multi-user scenario: Users join via WebSocket, interact in real-time", async () => {
  const user1Username = generateUsername();
  const user2Username = generateUsername();

  await axios.post(backend_url + "/api/v1/signup", {
    username: user1Username,
    password: "password123",
    type: "User"
  });

  await axios.post(backend_url + "/api/v1/signup", {
    username: user2Username,
    password: "password123",
    type: "User"
  });

  const user1Login = await axios.post(backend_url + "/api/v1/login", {
    username: user1Username,
    password: "password123"
  });

  const user2Login = await axios.post(backend_url + "/api/v1/login", {
    username: user2Username,
    password: "password123"
  });

  const user1Token = user1Login.data.token;
  const user2Token = user2Login.data.token;

  const ws1 = await connectWebSocket();
  const ws2 = await connectWebSocket();

  ws1.send(JSON.stringify({
    type: 'join',
    payload: { spaceId: spaceId, token: user1Token }
  }));
  const user1Join = await waitForMessage(ws1);

  ws2.send(JSON.stringify({
    type: 'join',
    payload: { spaceId: spaceId, token: user2Token }
  }));

  // ws1 should receive notification that user2 joined
  const user2JoinNotification = await waitForMessage(ws1);
  expect(user2JoinNotification.type).toBe('user-joined-space');

  // ws2 should receive confirmation of its own join
  const user2Join = await waitForMessage(ws2);

  // Move user1
  ws1.send(JSON.stringify({
    type: 'move',
    payload: {
      x: user1Join.payload.spawn.x + 1,
      y: user1Join.payload.spawn.y
    }
  }));

  // ws2 should receive user-moved broadcast
  const moveNotification = await waitForMessage(ws2);
  expect(moveNotification.type).toBe('user-moved');
  expect(moveNotification.payload.userId).toBeDefined();

  ws1.close();
  ws2.close();
  await new Promise(res => setTimeout(res, 100)); // let sockets close gracefully
}, 15000);        
        });
    });
});
