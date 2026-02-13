const zod = require('zod');

const eventCreationSchema = zod.object({
    title: zod.string().min(3, 'Title must be at least 3 characters long').max(200, 'Title must be at most 200 characters long'),
    description: zod.string().max(5000, 'Description must be at most 5000 characters long').optional(),
    mode: zod.enum(['virtual', 'in-person', 'hybrid']).optional(),
    startAt: zod.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format for startAt'),
    endAt: zod.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format for endAt').optional(),
    registrationDeadline: zod.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format for registrationDeadline').optional(),
    capacity: zod.number().int().positive().optional(),
    tags: zod.array(zod.string()).optional(),
    price: zod.number().min(0).optional(),
    location: zod.object({
        addressLine1: zod.string().max(200, 'Address Line 1 must be at most 200 characters long').optional(),
        addressLine2: zod.string().max(200, 'Address Line 2 must be at most 200 characters long').optional(),
        city: zod.string().max(100, 'City must be at most 100 characters long').optional(),
        state: zod.string().max(100, 'State must be at most 100 characters long').optional(),
        country: zod.string().max(100, 'Country must be at most 100 characters long').optional(),
        postalCode: zod.string().max(20, 'Postal Code must be at most 20 characters long').optional(),
    }).optional(),
});

const eventUpdateSchema = eventCreationSchema.partial();

module.exports = { eventCreationSchema, eventUpdateSchema };