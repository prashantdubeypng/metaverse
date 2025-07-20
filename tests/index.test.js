// describe block we use to test the code
const axios = require("axios")
// for now to test we use hard codeded url 
const backend_url = "http://localhost:3000"
// This to check is our sign up url working
describe("auth",()=>{
    test("User is able to signup only once",async()=>{
        const username = "prashant"+Math.random();
        const password = "123456";
       const response = await axios.post(backend_url+"/api/v1/signup",{
            username,
            password,
            type:"admin"
        })
        // if geting 200 that be working good
        expect(response.statusCode),toBe(200)
        // to send again signup for same id and password 
        // it should reject the req
        const updatedresponse = await axios.post(backend_url+"/api/v1/signup",{
            username,
            password,
            type:"admin"
        })
        expect(updatedresponse.statusCode).toBe(400)
    })
    test("sign up server get send 400 if the username is empty",async()=>{
         const username = "prashant"+Math.random();
        const password = "123456";
        const response =await axios.post(backend_url+"/api/v1/signup",{
            password,
            type:"admin"
        })
        expect(response.statusCode).toBe(400)
        const responseupdated =await axios.post(backend_url+"/api/v1/signup",{
            username,
            type:"admin"
        })
        expect(responseupdated.statusCode).toBe(400) 
    })
    test("signin succeeds if the username and password are correcr",async()=>{
        const username = "prashant"+Math.random();
        const password = "12345678"
        const response = await axios.post(backend_url+"/api/v1/signin",{
            username,
            password
        })
        expect(response.statusCode).toBe(200)
        expect(response.body.token).toBeDefine()
    })
    test("signin fail if the username and password are incorrect",async()=>{
        const username = "prashant"+Math.random();
        const password = "12345678"
        const response = await axios.post(backend_url+"/api/v1/signin",{
            username,
            password
        })
        expect(response.statusCode).toBe(403)
        expect(response.body.token).not.toBeDefine()
    })
});
describe("user metadata update ",()=>{
    const token = "";
     const avataridg = ""
beforeAll(async()=>{
const username = "prashant"+Math.random()
const password = "12345678"
await axios.post(backend_url+"/api/v1/signup",{
    username,
    password,
    type:"admin"
})

const response = await axios.post(backend_url+"/api/v1.signin",{
    username,
    password
})
token = response.body.token

const avatarid = await axios.post(backend_url+"/api/v1/admin/avatar",{
    imageurl:"https//avatar/avtar234gh",
    name : "monkey"
})
avataridg = avatarid.body.avatarId
})
test(" user can't update metadata",async()=>{
    const response = await axios.post(backend_url+"/api/v1/user/metadata",{
        avtar:"123456789"
    },{
        headers:{
            "Authorization":token
        }
    })
    expect(response.statusCode).toBe(400)
})
test(" user can update metadata",async()=>{
    const response = await axios.post(backend_url+"/api/v1/user/metadata",{
        avtar:avatarid
    },{
        headers:{
            "Authorization":token
        }
    })
    expect(response.statusCode).toBe(200)
})
test("user dont send token",async()=>{
    const response = await axios.post(backend_url+"/api/v1/user/metadata",{
        avatar:avataridg
    })
    expect(response.statusCode).toBe(403)
})
})
describe("user avatar information",()=>{
    let token;
    let avataridg;
    let userid;
    beforeAll(async()=>{
const signupresponse = await axios.post(backend_url+"/api/v1/signup",{
    username,
    password,
    type:"admin"
})
userid = signupresponse.data.UserId;
const response = await axios.post(backend_url+"/api/v1.signin",{
    username,
    password
})
token = response.body.token

const avatarid = await axios.post(backend_url+"/api/v1/admin/avatar",{
    imageurl:"https//avatar/avtar234gh",
    name : "monkey"
})
avataridg = avatarid.body.avatarId

    })
    test("get back the avatar information from the server of the user",async()=>{
      const resoponse = await  axios.get(backend_url+`/api/v1/user/metadata/bulk/ids=${userid}`)
      expect(resoponse.data.avatars.length).toBe(1)
      expect(resoponse.data.avatars[0].userid).toBe(userid);
    })
    test("get the all existing avatar from the server",async()=>{
        const response = await axios.get(backend_url+"/api/v1/avatars")
        expect (response.data.avatars.length).not.toBe(0)
        expect(response.statusCode).toBe(200)
    }) 
})

