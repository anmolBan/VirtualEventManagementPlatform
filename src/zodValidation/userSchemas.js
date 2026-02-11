const zod = require('zod');

const userRegistrationSchema = zod.object({
    name: zod.string().min(2, 'Name must be at least 2 characters long'),
    username: zod.string().min(3, 'Username must be at least 3 characters long').max(15, 'Username must be at most 15 characters long'),
    email: zod.string().email('Invalid email address'),
    password: zod.string().min(6, 'Password must be at least 6 characters long'),
});

module.exports = {
    userRegistrationSchema,
};