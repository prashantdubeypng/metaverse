import { Router } from 'express';
export const adminRouter = Router();
import {createAvatar,createElement, createMapSchema}from '../../types'
import { adminmiddleware } from '../../middleware/Admin';
import client from '@repo/db';
adminRouter.get('/', (req, res) => {
    res.send('Admin route is working');
});
adminRouter.post('/map',adminmiddleware,async(req,res)=>{
    const parser = createMapSchema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    // Here you would typically save the map to a database or perform some action with it
    try{
        const map = await client.map.create({
            data:{
                createrId : req.userId,
                thumbnail: parser.data.thumbnail,
                name: parser.data.name,
                width: parseInt(parser.data.dimensions.split('x')[0]),
                height: parseInt(parser.data.dimensions.split('x')[1]),
                mapElements:{
                    create: parser.data.defaultelement.map(e => ({
                        elementId: e.elementId,
                        x: parseInt(e.x),
                        y: parseInt(e.y),
                    })),
                },
            }
        })
        res.json({
            message: 'Map created successfully',
            mapId: map.id
        });
    }catch(e){
        res.status(500).json({
            message:'internal server error'
        });
    }

});
adminRouter.post('/avatar',adminmiddleware,async(req,res)=>{
    const parse =createAvatar.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).send(parse.error);
    }
    try{
        const avatar = await client.avatar.create({
            data:{
                name: parse.data.name,
                imageurl: parse.data.imageurl
            }
        });
        if(!avatar){
            res.status(400).json({
                message:'avatar not created'
            });
        }
        res.json({
            message:'avatar created',
            avatarId:avatar.id
        });

    }catch(e){
        res.status(500).json({
            message:'internal server error'
        });
    }
});
adminRouter.post('/element',adminmiddleware,async(req,res)=>{
    const parser = createElement.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    try{
        const element = await client.element.create({
            data:{
                imageurl: parser.data.imageurl,
                width: parseInt(parser.data.width),
                height: parseInt(parser.data.height),
                static: parser.data.static,
            }
        })
        if(!element){
            console.error('error in creating the elment')
            return res.json('try again later')
        }
        res.json({
            message:'element created',
            elementId:element.id
        })
    }catch(e){
        res.status(500).json({
            message:'internal server error'
        })
    }
    
});
adminRouter.get('/get-all/maps',adminmiddleware,async(req,res)=>{
    try{
        const id = req.userId;
        const data = await client.map.
findMany({
    where:{
        createrId:id
    }
})
return res.json({message:'sucess',data:data})
    }catch(error){
        console.error('some thing went wrong', error);
        return res.json({message:'maps get wrong', error})
    }
})
