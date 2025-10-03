import { Router } from 'express';
export const router = Router();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import client from '@repo/db';
import { userrouter } from './user';
import { spaceRouter } from './space';
import { adminRouter } from './admin';
import { chatroomRouter } from './chatroom';
// import { messagesRouter } from './messages';
import { mapRouter } from './map';
import { signupSchema,loginSchema} from '../../types';
import { jwt_password } from '../../config';
router.post('/auth/signup',async (req , res)=>{
    // Handle signup logic here
    // For example, validate the request body against the signupSchema
    // and create a new user in the database.
    // This is just a placeholder response.
    console.log('Signup request received:', req.body);
    const parser = signupSchema.safeParse(req.body);
    if (!parser.success) {
        console.log('vaidation error')
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
                email:parser.data.email
            },
        });
        
        // Generate a JWT token for the new user
        const token = jwt.sign({ 
            userId: user.id,
            username: user.username, 
            role: user.role }, 
            jwt_password);
            
         return res.status(201).json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email || '',
                role: user.role,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            token: token
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
router.post('/auth/login',async(req,res)=>{
    // Handle login logic here
    // Validate the request body against the loginSchema
    // and authenticate the user.
    // This is just a placeholder response.
    console.log('Login request received:', req.body);
    const parser = loginSchema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    try {
        const user = await client.user.findUnique({
            where:{username:parser.data.username}
        });
        console.log(111111111111111111111111111)
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
            console.log(2222222222222222222222222222222222222222)
        return res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email || '',
                role: user.role,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            token: token
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
        
    }
});

// Add profile endpoint
router.get('/auth/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, jwt_password) as any;
        
        const user = await client.user.findUnique({
            where: { id: decoded.userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({
            id: user.id,
            username: user.username,
            email: user.email || '',
            role: user.role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Profile error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
});

router.get('/elements',async(req,res)=>{
     try{
        const elements = await client.element.findMany()
        console.log(elements)
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
router.use('/chatroom',chatroomRouter);
// router.use('/messages',messagesRouter);
router.use('/map',mapRouter);