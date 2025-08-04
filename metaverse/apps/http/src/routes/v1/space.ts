import { Router } from 'express';
import { addelement, createSpaceSchema, deleteelementSchema } from '../../types';
import { Usermiddleware } from '../../middleware/User';
import client from '@repo/db';
export const spaceRouter = Router();

/**
 * Create Space Route
 * This route handles the creation of a new space in the metaverse.
 * It requires user authentication and validates the space dimensions.
 * 
 * @route POST /v1/space/
 * @param req - Express request object
 * @param res - Express response object
 * @returns JSON response with space creation result
 */
spaceRouter.post('/', Usermiddleware, async (req, res) => {
    const parser = createSpaceSchema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).json({ error: 'Invalid request data', details: parser.error });
    }

    try {
        // Check if mapId is provided, if not, create a space without a map
        if(!parser.data.mapId) {
            // Parse dimensions from format "100x200" to integers
        const [widthStr, heightStr] = parser.data.dimensions.split('x');
        const width = parseInt(widthStr);
        const height = parseInt(heightStr);

        // Validate parsed integers
        if (isNaN(width) || isNaN(height)) {
            return res.status(400).json({ error: 'Invalid dimensions format' });
        }
        const space = await client.space.create({
            data:{
                name: parser.data.name,
                width: width,
                height: height,
                creatorId: req.userId as string,
            }
        });
        res.json({
            spaceId:space.id
                });
        }
        // if mapid is provided , add the elements in that space 
        else{
            const map = await client.map.findUnique({
                where:{
                    id: parser.data.mapId
                },select:{
                    mapElements:true,
                    width:true,
                    height:true
                }
            })
            if (!map) {
                return res.status(404).json({ message: 'Map not found' });
            }
            /** Create space 
             * What is $transaction?
             * A database transaction is a way to group multiple database operations 
             * together so they either ALL succeed or ALL fail. Think of it as "all or 
             * nothing."
             * Why Use Transaction Here?
            Problem Without Transaction:
              Space gets created
              Space elements creation fails(maybe network issue, validation error, etc.)
              Result: You have a broken space with no elements in your database!
              Solution With Transaction:
              Space creation and space elements creation are grouped together
              If ANY operation fails, BOTH are rolled back
              Result: Either you get a complete space with all elements OR nothing at 
              all
             */
            let space = await client.$transaction(async () => {
                const space = await client.space.create({
                    data: {
                        name: parser.data.name,
                    width: map.width,
                    height: map.height,
                    creatorId: req.userId as string,
                }
            });
            /** Create space elements
             * Prisma automatically converts PascalCase
             * model names to camelCase for the client methods:
               SpaceElements (schema) → spaceElements (client)
               MapElements (schema) → mapElements (client)
               User (schema) → user (client)
               Space (schema) → space (client)
               that why it is giving the error previously
             */
            await client.spaceElements.createMany({
                data: map.mapElements.map((element) => ({
                    spaceId: space.id,
                    elementId: element.elementId,
                    x: element.x!,
                    y: element.y!,
                })),
            })
            return space;
            })
            res.json({
                spaceId:space.id
            })
        }
    } catch (error) {
        console.error('Error creating space:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
spaceRouter.delete('/:spaceid',Usermiddleware,async(req,res)=>{
    try{
        const space = await client.space.findUnique({
            where:{
                id:req.params.spaceId
            },select:{
                creatorId:true
            }
        })
        if(!space){
            res.status(400).json({
                message:'space not found'
            })
        }
        if(space.creatorId!==req.userId){
                res.status(403).json({
                    message:'unautorized'
                })
            }
            await client.space.delete({
                where:{
                    id:req.params.spaceId
                }
            })
            res.json({
                message:'space deleted'
            });
    }catch(e){
        console.error(e);
        res.status(500).json({
            message:'internal server error'
        });
    }
});
spaceRouter.get('/:spaceid',Usermiddleware,async(req,res)=>{
    try{
        const space = await client.space.findUnique({
            where:{
                id:req.params.spaceid
            },
            include:{
                elements:{
                    include:{
                        element:true
                    }
                }
            }
        })
        if(!space){
            res.status(400).json({
                message:'space not found'
            })
        }
        res.json({
            "dimensions":`${space.width}x${space.height}`,
            elements:space.elements.map(e=>({
                id:e.id,
                element:{
                    id:e.element.id,
                    imageurl:e.element.imageurl,
                    width:e.element.width,
                    height:e.element.height,
                    static:e.element.static,
                },
                x:e.x,
                y:e.y
            })),

        })


    }catch(e){
        res.status(500).json({
            message:'internal server error'
        })
    }
    
    
});
spaceRouter.get('/all',Usermiddleware,async(req,res)=>{
    try{
        const allspace = await client.space.findMany({
            where:{
                creatorId:req.userId!
            }
        });
        res.json({
            spaces:allspace.map(s=>({
                id:s.id,
                name:s.name,
                thumbnail:s.thumbnail,
                dimensions:`${s.width}x${s.height}`,
            }))
        })

    }catch(e){
        res.status(500).json({
            message:'internal server error'
        })
    }
});
spaceRouter.post('/element',Usermiddleware,async(req,res)=>{
    const parse = addelement.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).send(parse.error);
    }
    try{
        const space = await client.space.findUnique({
            where:{
                id:req.body.spaceId,
                creatorId:req.userId
            },select:{
                width:true,
                height:true
            }
        })
        if(!space){
            res.status(400).json({
                message:'space not found'
            })
        }
        await client.spaceElements.create({
            data:{
                spaceId:req.body.spaceId,
                elementId:req.body.elementId,
                x:req.body.x,
                y:req.body.y
            }
        })
        res.json({
            message:'elemenet added into space'
        })
    }catch(e){
        res.status(500).json({message:'internal server error'})
    }
});
spaceRouter.delete('/element/',Usermiddleware,async(req,res)=>{
    const parse = deleteelementSchema.safeParse(req.body);
    if(!parse.success){
        return res.status(400).send(parse.error);
    }
    try{
        const spaceelements = await client.spaceElements.findFirst({
            where:{
                id:parse.data.id
            },
            include:{
                space:true
            }
        })
        if(!spaceelements?.space.creatorId||spaceelements.space.creatorId!==req.userId){
            res.status(400).json({
                message:'unauthorized'
            })
        }
        await client.spaceElements.delete({
            where:{
                id:parse.data.id
            }
        })
        res.json({
            message:'element deleted from space'
        })
    }catch(e){
        res.status(500).json({message:'internal server error'})
    }
});