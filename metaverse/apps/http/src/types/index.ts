import z from 'zod';
 export const signupSchema = z.object({
    username: z.string(),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    type: z.enum(['User', 'Admin'])
    });
    export const loginSchema = z.object({
    username: z.string(),
    password: z.string().min(6),
    });
    export const updatemetadata=z.object({
      avatarId:z.string(),
    });
    export const createmap = z.object({
      name: z.string(),
      dimensions:z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
      mapId:z.string()
    });
    export const addelement = z.object({
      spaceId: z.string(),
      elementId: z.string(),
      x:z.string(),
      y:z.string(),
    });
    export const createElement = z.object({
      imageurl: z.string(),
      width:z.string(),
      height:z.string(),
      static: z.boolean(),
    });
    export const updateElement = z.object({
      imageurl: z.string(),
    });
    export const createAvatar = z.object({
      name: z.string(),
      imageurl: z.string()
    });
    export const createMapSchema = z.object({
      thumbnail: z.string(),
      name: z.string(),
      dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
      defaultelement: z.array(z.object({
         elementId: z.string(),
         x: z.string(),
         y: z.string(),
      })),
    });
