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
    import { jwt_password , Email , Email_password } from '../../config';
    import nodemailer from "nodemailer";

    export async function Email_service(email: string, email_password: string , to:string , otp:string) {
    // Create a transporter object
    const transporter = nodemailer.createTransport({
        service: "gmail", // or use custom SMTP config
        auth: {
        user: email,
        pass: email_password,
        },
    });

    // Function to send OTP email
    return async function sendOTPEmail() {
        const subject = "MetaSpace Password Reset OTP";
        const text = `Your MetaSpace OTP is: ${otp}`;

        const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f6f7fb;">
            <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #3b82f6, #9333ea); color: white; text-align: center; padding: 15px 0;">
                <h2>MetaSpace</h2>
            </div>
            <div style="padding: 25px;">
                <h3 style="color: #111827;">Forgot Your Password?</h3>
                <p style="color: #374151;">No worries! Use the OTP below to reset your MetaSpace account password:</p>
                <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                ${otp}
                </div>
                <p style="color: #6b7280;">This OTP will expire in <b>10 minutes</b>. Please do not share it with anyone.</p>
                <p style="margin-top: 25px; color: #9ca3af;">— The MetaSpace Security Team</p>
            </div>
            </div>
        </div>
        `;

        try {
        const info = await transporter.sendMail({
            from: `"MetaSpace Support" <${email}>`,
            to,
            subject,
            text,
            html,
        });

        console.log("OTP Email sent:", info.messageId);
        return info;
        } catch (error) {
        console.error("Error sending OTP email:", error);
        throw error;
        }
    };
    }

    router.post('/auth/forget/password', async (req, res) => {
        try {
            const body = req.body;
            
            // Validate username is provided
            if (!body.username) {
                return res.status(400).json({ message: "Username is required", status: 400 });
            }

            // Find user by username
            const user = await client.user.findUnique({
                where: {
                    username: body.username
                }
            });

            if (!user) {
                return res.status(404).json({ message: "User not found", status: 404 });
            }

            // Check if user has an email
            if (!user.email) {
                return res.status(400).json({ 
                    message: "No email associated with this account", 
                    status: 400 
                });
            }

            // Generate OTP
            const generateOtp = (length = 6) => {
                if (length <= 0 || !Number.isInteger(length)) {
                    throw new Error("OTP length must be a positive integer.");
                }

                const min = Math.pow(10, length - 1);
                const max = Math.pow(10, length) - 1;
                const otp = Math.floor(Math.random() * (max - min + 1)) + min;

                return otp.toString();
            };

            const otp = generateOtp();

            // Create JWT token with OTP embedded (expires in 10 minutes)
            const token = jwt.sign(
                {
                    userId: user.id,
                    username: user.username,
                    otp: otp
                },
                jwt_password,
                { expiresIn: '10m' }
            );

            // Send OTP email
            const emailService = await Email_service(Email, Email_password, user.email, otp);
            await emailService();

            console.log(`OTP sent to ${user.email} for user ${user.username}`);

            // Return success with token (client will send this back with OTP verification)
            return res.status(200).json({
                message: "OTP sent to your email",
                status: 200,
                resetToken: token,
                expiresIn: "10 minutes"
            });

        } catch (error) {
            console.error('Forgot password error:', error);
            return res.status(500).json({ 
                message: "Failed to send OTP email", 
                status: 500 
            });
        }
    });

    // Verify OTP and reset password
    router.post('/auth/reset/password', async (req, res) => {
        try {
            const { resetToken, otp, newPassword } = req.body;

            // Validate required fields
            if (!resetToken || !otp || !newPassword) {
                return res.status(400).json({ 
                    message: "Reset token, OTP, and new password are required", 
                    status: 400 
                });
            }

            // Verify and decode the reset token
            let decoded: any;
            try {
                decoded = jwt.verify(resetToken, jwt_password);
            } catch (error) {
                return res.status(401).json({ 
                    message: "Invalid or expired reset token", 
                    status: 401 
                });
            }

            // Verify OTP matches
            if (decoded.otp !== otp) {
                return res.status(401).json({ 
                    message: "Invalid OTP", 
                    status: 401 
                });
            }

            // Hash new password
            const saltRounds = 15;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update user password
            await client.user.update({
                where: { id: decoded.userId },
                data: { password: hashedPassword }
            });

            console.log(`Password reset successful for user ${decoded.username}`);

            return res.status(200).json({
                message: "Password reset successful",
                status: 200
            });

        } catch (error) {
            console.error('Reset password error:', error);
            return res.status(500).json({ 
                message: "Failed to reset password", 
                status: 500 
            });
        }
    });
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