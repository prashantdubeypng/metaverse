const axios = require("axios");
const backend_url = "http://localhost:3000";

describe("auth", () => {
    test("User is able to signup only once", async () => {
        const username = "prashant" + Math.random();
        const password = "123456";
        
        try {
            const response = await axios.post(backend_url + "/api/v1/signup", {
                username,
                password,
                type: "Admin" // Fixed: should be "Admin" not "ADMIN"
            });
            // Fixed: Added dot and expect 201 for creation
            expect(response.status).toBe(201);
            
            // Try to signup again with same credentials
            try {
                const updatedresponse = await axios.post(backend_url + "/api/v1/signup", {
                    username,
                    password,
                    type: "Admin"
                });
                // This should not execute
                expect(true).toBe(false);
            } catch (error) {
                // Fixed: Expect 409 for conflict (user already exists)
                expect(error.response.status).toBe(409);
            }
        } catch (error) {
            console.error("Signup failed:", error.response?.data);
            throw error;
        }
    });

    test("signup server sends 400 if the username is empty", async () => {
        const password = "123456";
        
        try {
            const response = await axios.post(backend_url + "/api/v1/signup", {
                password,
                type: "Admin"
            });
            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error.response.status).toBe(400);
        }

        try {
            const username = "prashant" + Math.random();
            const responseupdated = await axios.post(backend_url + "/api/v1/signup", {
                username,
                type: "Admin"
                // Missing password
            });
            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error.response.status).toBe(400);
        }
    });

    test("signin succeeds if the username and password are correct", async () => {
        const username = "prashant" + Math.random();
        const password = "12345678";
        
        // First create the user
        await axios.post(backend_url + "/api/v1/signup", {
            username,
            password,
            type: "User"
        });
        
        // Then try to login
        const response = await axios.post(backend_url + "/api/v1/login", {
            username,
            password
        });
        
        expect(response.status).toBe(200);
        expect(response.data.token).toBeDefined(); // Fixed: .data not .body
    });

    test("signin fails if the username and password are incorrect", async () => {
        const username = "nonexistent" + Math.random();
        const password = "wrongpassword";
        
        try {
            const response = await axios.post(backend_url + "/api/v1/login", { // Fixed: /login not /signin
                username,
                password
            });
            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error.response.status).toBe(401); // Fixed: 401 for unauthorized
            expect(error.response.data.token).toBeUndefined(); // Fixed: toBeUndefined not toBeDefine
        }
    });
});
describe("user metadata update ",()=>{
    let token = "";
    let avataridg = ""
beforeAll(async()=>{
const username = "prashant"+Math.random()
const password = "12345678"
await axios.post(backend_url+"/api/v1/signup",{
    username,
    password,
    type:"Admin"  // Fixed: Should be "Admin" not "admin"
})

const response = await axios.post(backend_url+"/api/v1/login",{  // Fixed: /login not /signin
    username,
    password
})
token = response.data.token  // Fixed: .data not .body

const avatarid = await axios.post(backend_url+"/api/v1/admin/avatar",{
    imageurl:"https://avatar/avatar234gh",  // Fixed: https not https//
    name : "monkey"
},{
    headers: {
        "Authorization": `Bearer ${token}`  // Added: Admin endpoints need auth
    }
})
avataridg = avatarid.data.avatarId  // Fixed: .data not .body
})
test(" user can't update metadata",async()=>{
    try {
        const response = await axios.post(backend_url+"/api/v1/user/metadata",{
            avatarId:"123456789"  // Fixed: avatarId not avtar
        },{
            headers:{
                "Authorization": `Bearer ${token}`  // Fixed: Added Bearer prefix
            }
        })
        // Should not reach here
        expect(true).toBe(false);
    } catch (error) {
        expect(error.response.status).toBe(400)  // Fixed: .status not .statusCode
    }
})
test(" user can update metadata",async()=>{
    const response = await axios.post(backend_url+"/api/v1/user/metadata",{
        avatarId:avataridg  // Fixed: avatarId not avtar
    },{
        headers:{
            "Authorization": `Bearer ${token}`  // Fixed: Added Bearer prefix
        }
    })
    expect(response.status).toBe(200)  // Fixed: .status not .statusCode
})
test("user dont send token",async()=>{
    try {
        const response = await axios.post(backend_url+"/api/v1/user/metadata",{
            avatarId:avataridg  // Fixed: avatarId not avatar
        })
        // Should not reach here
        expect(true).toBe(false);
    } catch (error) {
        expect(error.response.status).toBe(401)  // Fixed: Should be 401 for missing auth,
    }
})
})
describe("user avatar information",()=>{
    let token;
    let avataridg;
    let userid;
    let username;  // Added: Missing variable declaration
    let password;  // Added: Missing variable declaration
    
    beforeAll(async()=>{
        username = "prashant" + Math.random();  // Added: Generate unique username
        password = "12345678";  // Added: Set password
        
        const signupresponse = await axios.post(backend_url+"/api/v1/signup",{
            username,
            password,
            type:"Admin"  // Fixed: Should be "Admin" not "admin"
        })
        userid = signupresponse.data.userId;  // Fixed: userId not UserId
        
        const response = await axios.post(backend_url+"/api/v1/login",{  // Fixed: /login not /signin
            username,
            password
        })
        token = response.data.token  // Fixed: .data not .body

        const avatarid = await axios.post(backend_url+"/api/v1/admin/avatar",{
            imageurl:"https://avatar/avatar234gh",  // Fixed: https not https//
            name : "monkey"
        },{
            headers: {
                "Authorization": `Bearer ${token}`  // Added: Admin endpoints need auth
            }
        })
        avataridg = avatarid.data.avatarId  // Fixed: .data not .body
    })
    test("get back the avatar information from the server of the user",async()=>{
        // First update user metadata with the avatar
        await axios.post(backend_url+"/api/v1/user/metadata",{
            avatarId: avataridg
        },{
            headers:{
                "Authorization": `Bearer ${token}`
            }
        });
        
        // Then get the bulk metadata - correct URL format with JSON array
        const response = await axios.get(backend_url+`/api/v1/user/metadata/bulk?ids=["${userid}"]`,{
            headers:{
                "Authorization": `Bearer ${token}`  // Added: Auth required
            }
        });
        
        // The response should contain avatar data for users who have avatars set
        expect(response.data.avatar.length).toBe(1);  // Should find 1 user with avatar
        expect(response.data.avatar[0].userId).toBe(userid);  // Should match our user
        expect(response.data.avatar[0].avatarImageUrl).toBeDefined();  // Should have avatar URL
    })
    test("get the all existing avatar from the server",async()=>{
        const response = await axios.get(backend_url+"/api/v1/avatars")
        expect(response.data.avatars.length).not.toBe(0);  // Fixed: .data not missing
        expect(response.status).toBe(200);  // Fixed: .status not .statusCode
    }) 
})

