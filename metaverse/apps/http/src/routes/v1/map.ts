import { Router } from 'express';
import { Usermiddleware } from '../../middleware/User';
import client from '@repo/db';

export const mapRouter = Router();

// Apply user middleware to all routes
mapRouter.use(Usermiddleware);

/**
 * Get all available maps
 */
mapRouter.get('/all', async (req, res) => {
    try {
        const maps = await client.map.findMany({
            include: {
                mapElements: {
                    include: {
                        element: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return res.json({
            success: true,
            maps: maps.map(map => ({
                id: map.id,
                name: map.name,
                width: map.width,
                height: map.height,
                thumbnail: map.thumbnail,
                elementCount: map.mapElements.length
            }))
        });

    } catch (error) {
        console.error('Error fetching maps:', error);
        return res.status(500).json({
            error: 'Failed to fetch maps',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get map by ID with all elements
 */
mapRouter.get('/:mapId', async (req, res) => {
    const { mapId } = req.params;

    try {
        const map = await client.map.findUnique({
            where: { id: mapId },
            include: {
                mapElements: {
                    include: {
                        element: true
                    }
                }
            }
        });

        if (!map) {
            return res.status(404).json({ error: 'Map not found' });
        }

        return res.json({
            success: true,
            map: {
                id: map.id,
                name: map.name,
                width: map.width,
                height: map.height,
                thumbnail: map.thumbnail,
                elements: map.mapElements.map(mapElement => ({
                    id: mapElement.id,
                    x: mapElement.x || 0,
                    y: mapElement.y || 0,
                    element: {
                        id: mapElement.element.id,
                        width: mapElement.element.width,
                        height: mapElement.element.height,
                        imageurl: mapElement.element.imageurl,
                        static: mapElement.element.static
                    }
                }))
            }
        });

    } catch (error) {
        console.error('Error fetching map:', error);
        return res.status(500).json({
            error: 'Failed to fetch map',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Create a new map (admin only)
 */
mapRouter.post('/create', async (req, res) => {
    const { name, width, height, thumbnail } = req.body;

    if (!name || !width || !height) {
        return res.status(400).json({ error: 'Name, width, and height are required' });
    }

    try {
        const newMap = await client.map.create({
            data: {
                name,
                width: parseInt(width),
                height: parseInt(height),
                thumbnail: thumbnail || ''
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Map created successfully',
            map: newMap
        });

    } catch (error) {
        console.error('Error creating map:', error);
        return res.status(500).json({
            error: 'Failed to create map',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Add element to map (admin only)
 */
mapRouter.post('/:mapId/elements', async (req, res) => {
    const { mapId } = req.params;
    const { elementId, x, y } = req.body;

    if (!elementId || x === undefined || y === undefined) {
        return res.status(400).json({ error: 'ElementId, x, and y coordinates are required' });
    }

    try {
        // Check if map exists
        const map = await client.map.findUnique({ where: { id: mapId } });
        if (!map) {
            return res.status(404).json({ error: 'Map not found' });
        }

        // Check if element exists
        const element = await client.element.findUnique({ where: { id: elementId } });
        if (!element) {
            return res.status(404).json({ error: 'Element not found' });
        }

        // Add element to map
        const mapElement = await client.mapElements.create({
            data: {
                mapId,
                elementId,
                x: parseInt(x),
                y: parseInt(y)
            },
            include: {
                element: true
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Element added to map successfully',
            mapElement: {
                id: mapElement.id,
                x: mapElement.x,
                y: mapElement.y,
                element: mapElement.element
            }
        });

    } catch (error) {
        console.error('Error adding element to map:', error);
        return res.status(500).json({
            error: 'Failed to add element to map',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Remove element from map (admin only)
 */
mapRouter.delete('/elements/:mapElementId', async (req, res) => {
    const { mapElementId } = req.params;

    try {
        const mapElement = await client.mapElements.findUnique({
            where: { id: mapElementId }
        });

        if (!mapElement) {
            return res.status(404).json({ error: 'Map element not found' });
        }

        await client.mapElements.delete({
            where: { id: mapElementId }
        });

        return res.json({
            success: true,
            message: 'Element removed from map successfully'
        });

    } catch (error) {
        console.error('Error removing element from map:', error);
        return res.status(500).json({
            error: 'Failed to remove element from map',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Update element position on map (admin only)
 */
mapRouter.put('/elements/:mapElementId', async (req, res) => {
    const { mapElementId } = req.params;
    const { x, y } = req.body;

    if (x === undefined || y === undefined) {
        return res.status(400).json({ error: 'x and y coordinates are required' });
    }

    try {
        const mapElement = await client.mapElements.update({
            where: { id: mapElementId },
            data: {
                x: parseInt(x),
                y: parseInt(y)
            },
            include: {
                element: true
            }
        });

        return res.json({
            success: true,
            message: 'Element position updated successfully',
            mapElement: {
                id: mapElement.id,
                x: mapElement.x,
                y: mapElement.y,
                element: mapElement.element
            }
        });

    } catch (error) {
        console.error('Error updating element position:', error);
        return res.status(500).json({
            error: 'Failed to update element position',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Delete map (admin only)
 */
mapRouter.delete('/:mapId', async (req, res) => {
    const { mapId } = req.params;

    try {
        const map = await client.map.findUnique({ where: { id: mapId } });
        if (!map) {
            return res.status(404).json({ error: 'Map not found' });
        }

        await client.map.delete({ where: { id: mapId } });

        return res.json({
            success: true,
            message: 'Map deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting map:', error);
        return res.status(500).json({
            error: 'Failed to delete map',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
