import { Router } from 'express';
export const adminRouter = Router();
import {createAvatar,createElement, createMapSchema}from '../../types'
adminRouter.get('/', (req, res) => {
    res.send('Admin route is working');
});
adminRouter.post('/map',(req,res)=>{
    const parser = createMapSchema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    // Here you would typically save the map to a database or perform some action with it
res.send('map created');
});
adminRouter.post('/avatar',(req,res)=>{
    const parse =createAvatar.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).send(parse.error);
    }
    res.send('avatar created');
});
adminRouter.post('/element',(req,res)=>{
    const parser = createElement.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    res.send('element created');
});
