import { Router } from 'express';
import { updatemetadata } from '../../types';
export const userrouter = Router();
import { Usermiddleware } from '../../middleware/User';
import client from '@repo/db';
/** User Metadata Update Route
 * This route handles the updating of user metadata.
 * It requires the user to be authenticated and have a valid JWT token.
 * The request body must contain the new metadata information.
 * * @route POST /v1/user/metadata
 * @param req - Express request object
 * @param res - Express response object
 * @returns JSON response with success message or error
*/
userrouter.post('/metadata',Usermiddleware, async (req, res) => {
    const parser = updatemetadata.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    // If the request is valid, proceed with the metadata update
    // The user ID is extracted from the request object by the Usermiddleware
    // and used to update the user's metadata in the database.
    try {
        // Check if the avatar exists first
        const avatar = await client.avatar.findUnique({
            where: { id: parser.data.avatarId }
        });
        
        if (!avatar) {
            return res.status(400).json({ error: 'Avatar not found' });
        }
        
        // Update user metadata with the new avatarId
        await client.user.update({ 
            where: { id: req.userId },
            data: {
                avatarId: parser.data.avatarId,
            },
        });
        res.json({
            message: 'User metadata updated successfully',
        });
    } catch (error) {
        console.error('Error updating user metadata:', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Bulk User Metadata Retrieval Route
 * This route handles the retrieval of metadata for multiple users.
 * It requires authentication and accepts an array of user IDs.
 * 
 * @route GET /v1/user/metadata/bulk?ids=[1,2,3]
 * @param req - Express request object
 * @param res - Express response object
 * @returns JSON response with user metadata array
 */
userrouter.get('/metadata/bulk',Usermiddleware, async (req, res) => {
    /** 
     * To convert a string containing IDs into an array in JavaScript,
     *  the most common and effective method is to use the split() method. 
     * This method allows you to divide a string into an ordered list of 
     * substrings and store them in an array, based on a specified 
     * separator.->Gemini
     */
    // Extract the 'ids' query parameter from the request
    /** 
     * The 'ids' query parameter is expected to be a JSON string representing an array of user IDs.
     * For example: ?ids=["user-id-1","user-id-2","user-id-3"]
     * We will parse this string to get the actual array of user IDs.
     * If the 'ids' parameter is not provided or is invalid, we will return a 400 Bad Request response.
     * * @returns JSON response with an array of user metadata objects
     * * @example
     * http://localhost:3000/api/v1/user/metadata/bulk?ids=["user-id-1","user-id-2","user-id-3"]
     */
    const UserStringId = (req.query.ids??"[]") as string;
    // Parse the JSON array properly instead of manual string manipulation
    let userIds: string[];
    try {
        userIds = JSON.parse(UserStringId);
    } catch (error) {
        return res.status(400).json({ error: 'Invalid ids format. Expected JSON array.' });
    }
    const metadata = await client.user.findMany({
        where:{
            id:{
                in:userIds
            }
        },
        select:{
                id:true,
                avatar: true,
            }
    });
    res.json({
        avatar:metadata.filter(m => m.avatar).map(m=>({
            userId: m.id,
            avatarImageUrl: m.avatar?.imageurl,
        }))
    });
    // console.log('User IDs:', userIds);
    // console.log('Type of userIds:', typeof userIds);
    // return res.status(400).send('Invalid request: user IDs are required');
});