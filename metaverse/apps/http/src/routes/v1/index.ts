import { Router } from 'express';
export const router = Router();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import client from '@repo/db';
import { userrouter } from './user';
import { spaceRouter } from './space';
import { adminRouter } from './admin';
import { signupSchema,loginSchema} from '../../types';
import { jwt_password } from '../../config';
router.post('/signup',async (req , res)=>{
    // Handle signup logic here
    // For example, validate the request body against the signupSchema
    // and create a new user in the database.
    // This is just a placeholder response.
    const parser = signupSchema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    try{
        const saltRounds = 15;
        const hashedPassword = await bcrypt.hash(parser.data.password, saltRounds);
        const user = await client.user.create({
            data: {
                username: parser.data.username,
                password: hashedPassword,
                role: parser.data.type==='Admin' ? 'Admin' : 'User',
            },
        });
         return res.status(201).json({
            message: 'User created successfully',
            userId: user.id,
            username: user.username,
            role: user.role
        });
    }catch(e){
        console.error(e);
        if (e && typeof e === 'object' && 'code' in e) {
            if (e.code === 'P2002') {
                return res.status(409).json({ error: 'Username already exists' });
            }
        }
        // Handle any errors that occur during signup processing
        return res.status(500).send('Internal Server Error');
    }
});
router.post('/login',async(req,res)=>{
    // Handle login logic here
    // Validate the request body against the loginSchema
    // and authenticate the user.
    // This is just a placeholder response.
    const parser = loginSchema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    try {
        const user = await client.user.findUnique({
            where:{username:parser.data.username}
        });
        if (!user) {
            return res.status(401).send('User not found');
        }
        // Compare the provided password with the stored hashed password
        // Assuming you have a bcrypt library installed for password hashing
        const isPasswordValid = await bcrypt.compare(parser.data.password, user.password);
        if (!isPasswordValid) {
            return res.status(401).send('Invalid password');
        }
        // Generate a JWT token for the user
        const token = jwt.sign({ 
            userId: user.id,
            username: user.username, 
            role: user.role }, 
            jwt_password);
        return res.json({
            message: 'Login successful',
            token: token,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
        
    }
});
router.get('/elements',async(req,res)=>{
     try{
        const elements = await client.element.findMany()
        res.json({elements:elements.map(x=>({
            id: x.id,
            imageurl: x.imageurl,
            width: x.width,
            height: x.height,
            static: x.static
        }))});
    }catch(e){
        console.error(e);
        return res.status(500).send('Internal Server Error');
     }
});
router.get('/avatars',async(req,res)=>{
    try{
        const avatars = await client.avatar.findMany();
        return res.json({avatars:avatars.map(x=>({
            id: x.id,
            imageurl: x.imageurl,
            name: x.name
        }))});
    }catch(e){
        console.error(e);
        return res.status(500).send('Internal Server Error');
    }
});
router.use('/user',userrouter);
router.use('/space',spaceRouter);
router.use('/admin',adminRouter);
