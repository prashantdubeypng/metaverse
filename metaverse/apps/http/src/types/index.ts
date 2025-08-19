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
    export const createSpaceSchema = z.object({
      name: z.string(),
      dimensions:z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
      mapId:z.string().optional().nullable()
    });
    export const addelement = z.object({
      spaceId: z.string(),
      elementId: z.string(),
      x:z.string(),
      y:z.string(),
    });
    export const deleteelementSchema =z.object({
      id:z.string()
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
      mapId: z.string().optional().nullable(),
      dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
      defaultelement: z.array(z.object({
         elementId: z.string(),
         x: z.string(),
         y: z.string(),
      })),
    });
    export const createchatroomschema = z.object({
      name:z.string(),
      description:z.string().max(500).optional(),
      isPrivate:z.boolean().default(false),
      roomid:z.string()
    })
    // used to validate the chatroomgetall route from this route all the chatrom ,
    //present in the spaceid
    export const chatroomgetall = z.object({
      SpaceId:z.string()
    })

    // Join request schemas
    export const joinRequestSchema = z.object({
      chatroomId: z.string(),
      message: z.string().max(500).optional()
    });

    export const processJoinRequestSchema = z.object({
      requestId: z.string(),
      action: z.enum(['approve', 'reject']),
      message: z.string().max(500).optional()
    });

    // Invitation schemas
    export const createInvitationSchema = z.object({
      userId: z.string(),
      chatroomId: z.string(),
      message: z.string().max(500).optional(),
      expiresInHours: z.number().min(1).max(168).default(24) // 1 hour to 1 week
    });

    export const respondToInvitationSchema = z.object({
      invitationId: z.string(),
      action: z.enum(['accept', 'decline'])
    });

    // Member management schemas
    export const manageMemberSchema = z.object({
      userId: z.string(),
      action: z.enum(['promote', 'demote', 'remove']),
      newRole: z.enum(['ADMIN', 'MEMBER']).optional()
    });
    
