const mongoose = require('mongoose');

// /src/db/userDBSchema.js


const { Schema } = mongoose;

const UserSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 3,
            maxlength: 15,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['attendee', 'organizer', 'admin'],
            default: 'attendee',
            index: true,
        }
    },
    {
        timestamps: true, // createdAt, updatedAt
    }
);


// Hide sensitive fields when converting to JSON
UserSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.passwordHash;
    return obj;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;