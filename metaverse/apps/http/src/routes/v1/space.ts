import { Router } from 'express';
import { addelement } from '../../types';
export const spaceRouter = Router();

spaceRouter.get('/', (req, res) => {
    res.send('Space route is working');
});
spaceRouter.delete('/:spaceid',(req,res)=>{
    const { spaceid } = req.params;
    res.send(`Space with ID ${spaceid} deleted`);
});
spaceRouter.get('/:spaceid',(req,res)=>{
    const { spaceid } = req.params;
    res.send(`Space with ID ${spaceid} fetched`);
});
spaceRouter.get('/all',(req,res)=>{
    res.send('All spaces fetched');
});
spaceRouter.post('/element',(req,res)=>{
    const parse = addelement.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).send(parse.error);
    }
    res.send('Element created in space');
});
spaceRouter.delete('/element/:deleteid',(req,res)=>{
    const { deleteid } = req.params;
    res.send(`Element with ID ${deleteid} deleted from space`);
});