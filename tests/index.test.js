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
// describe("user metadata update ",()=>{
//     const token = "";
//      const avataridg = ""
// beforeAll(async()=>{
// const username = "prashant"+Math.random()
// const password = "12345678"
// await axios.post(backend_url+"/api/v1/signup",{
//     username,
//     password,
//     type:"admin"
// })

// const response = await axios.post(backend_url+"/api/v1.signin",{
//     username,
//     password
// })
// token = response.body.token

// const avatarid = await axios.post(backend_url+"/api/v1/admin/avatar",{
//     imageurl:"https//avatar/avtar234gh",
//     name : "monkey"
// })
// avataridg = avatarid.body.avatarId
// })
// test(" user can't update metadata",async()=>{
//     const response = await axios.post(backend_url+"/api/v1/user/metadata",{
//         avtar:"123456789"
//     },{
//         headers:{
//             "Authorization":token
//         }
//     })
//     expect(response.statusCode).toBe(400)
// })
// test(" user can update metadata",async()=>{
//     const response = await axios.post(backend_url+"/api/v1/user/metadata",{
//         avtar:avatarid
//     },{
//         headers:{
//             "Authorization":token
//         }
//     })
//     expect(response.statusCode).toBe(200)
// })
// test("user dont send token",async()=>{
//     const response = await axios.post(backend_url+"/api/v1/user/metadata",{
//         avatar:avataridg
//     })
//     expect(response.statusCode).toBe(403)
// })
// })
// describe("user avatar information",()=>{
//     let token;
//     let avataridg;
//     let userid;
//     beforeAll(async()=>{
// const signupresponse = await axios.post(backend_url+"/api/v1/signup",{
//     username,
//     password,
//     type:"admin"
// })
// userid = signupresponse.data.UserId;
// const response = await axios.post(backend_url+"/api/v1.signin",{
//     username,
//     password
// })
// token = response.body.token

// const avatarid = await axios.post(backend_url+"/api/v1/admin/avatar",{
//     imageurl:"https//avatar/avtar234gh",
//     name : "monkey"
// })
// avataridg = avatarid.body.avatarId

//     })
//     test("get back the avatar information from the server of the user",async()=>{
//       const resoponse = await  axios.get(backend_url+`/api/v1/user/metadata/bulk/ids=${userid}`)
//       expect(resoponse.data.avatars.length).toBe(1)
//       expect(resoponse.data.avatars[0].userid).toBe(userid);
//     })
//     test("get the all existing avatar from the server",async()=>{
//         const response = await axios.get(backend_url+"/api/v1/avatars")
//         expect (response.data.avatars.length).not.toBe(0)
//         expect(response.statusCode).toBe(200)
//     }) 
// })

