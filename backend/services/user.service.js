const mongoService = require('./mongo.service');
const ObjectId = require('mongodb').ObjectId;
const bcrypt = require('bcryptjs');

module.exports = {
    query,
    login,
    loginWithFacebook,
    signup,
    getById,
    update,
    updateTripToUser,
    updateLikesToUser,
    updateSubscriber,
    findSubscriber,
    remove
}

const usersCollection = 'users';
const tripsCollection = 'trips';
const subscribersCollection = 'subscribers';

function query(userIds) {
    let mongoQuery = {}
    if (userIds) {
        userIds = userIds.map(userId => new ObjectId(userId))
        mongoQuery = { _id: { $in: userIds } }
    }
    return mongoService.connect()
        .then(db => db.collection(usersCollection)
            .find(mongoQuery)
            .sort()
            .toArray()
        );
}

async function login(credentials) {
    console.log(credentials);
    return mongoService.connect()
        .then(db => db.collection(usersCollection)
            .findOne({ email: credentials.email })
        )
        .then(async user => {
            if (!user) return null;
            const isAuth = await bcrypt.compare(credentials.password, user.password)
            if (isAuth) {
                delete user.password;
                await updateSubscriber(user._id, credentials.pushSub);
                return user;
            } else return null;
        });
}

async function findSubscriber(userId) {
    const db = await mongoService.connect();
    const subscriber = await db.collection(subscribersCollection).findOne({ userId: new ObjectId(userId) });
    return subscriber;
}

async function updateSubscriber(userId, pushSub) {
    console.log('GOT TO UPDATESUBSCRIBER WITH:');
    console.log('USERID:', userId);
    console.log('pushSub:', pushSub);
    const subscriber = await findSubscriber(userId);
    if (subscriber) {
        console.log('subscriber exists:', subscriber);
        subscriber.pushSub = pushSub;
        subscriber.userId = new ObjectId(subscriber.userId);
        const db = await mongoService.connect();
        await db.collection(subscribersCollection).updateOne({ _id: subscriber._id }, { $set: subscriber });
    } else {
        let newSubscriber = {
            userId: new ObjectId(userId),
            pushSub
        };
        console.log('subscriber doesnt exist, new:', newSubscriber);
        const db = await mongoService.connect();
        await db.collection(subscribersCollection).insertOne(newSubscriber);
    }
}

async function loginWithFacebook(user) {
    try {
        const {pushSub} = user;
        const db = await mongoService.connect();
        const userInDB = await db.collection(usersCollection).findOne({ email: user.email });
        if (!userInDB) {
            if (pushSub) delete user.pushSub;
            const { insertedId } = await db.collection(usersCollection).insertOne(user);
            user._id = insertedId;
            updateSubscriber(insertedId, pushSub);
            console.log('facebookuser registered:', user);
            return user;
        } else {
            if (userInDB.facebookId === user.facebookId) {
                updateSubscriber(userInDB._id, pushSub);
                return userInDB;
            }
            else throw new Error('User already exists, please log in using your Username and Password');
        }
    } catch (err) {
        throw err;
    }

}

// GET USER BY ID WITH MEMBERIN TRIPS AND PENDINGIN TRIPS:
async function getById(id) {
    try {
        const _id = new ObjectId(id);
        const db = await mongoService.connect();
        const userInDB = await db.collection(usersCollection).aggregate([
            {
                $match: {_id}
            },
            {
                $lookup:
                {
                    from: tripsCollection,
                    localField: 'memberIn',
                    foreignField: '_id',
                    as: 'memberIn'
    
                }
            },
            {
                $lookup: {
                    from: usersCollection,
                    localField: 'memberIn.userId',
                    foreignField: '_id',
                    as: 'memberInUsers'
                }
            },
            {
                $project: {
                    memberIn: {
                        user: {
                            password: 0
                        }
                    }
                }
            },
        
            {
                $lookup:
                {
                    from: tripsCollection,
                    localField: 'pendingIn',
                    foreignField: '_id',
                    as: 'pendingIn'
    
                }
            },
            {
                $lookup: {
                    from: usersCollection,
                    localField: 'pendingIn.userId',
                    foreignField: '_id',
                    as: 'pendingInUsers'
                }
            },
           
        ]).toArray();
        let user = null;
        // FIX THE MESS
        if (userInDB[0]) {
            user = {...userInDB[0]};
            user.memberIn = user.memberIn.map(trip => {
                let tripUser = user.memberInUsers.find(user => user._id.toString() === trip.userId.toString() );
                if (tripUser) {
                    delete tripUser.password;
                    trip.user = tripUser;
                    return trip;
                }
            });
            user.pendingIn = user.pendingIn.map(trip => {
                let tripUser = user.pendingInUsers.find(user => user._id.toString() === trip.userId.toString() );
                if (tripUser) {
                    delete tripUser.password;
                    trip.user = tripUser;
                    return trip;
                }
            });
            delete user.memberInUsers;
            delete user.pendingInUsers;
            delete user.password;
        }
        return user;
    } catch(err) {
        return null;
    }
}

async function signup(user) {
    const db = await mongoService.connect();
    const userInDB = await db.collection(usersCollection).findOne({ email: user.email })
    if (!userInDB) {
        try {
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(user.password, salt);
            user.password = hashedPassword;
            const { insertedId } = await db.collection(usersCollection).insertOne(user);
            user._id = insertedId;
            delete user.password;
            return user;
        } catch {
            throw (401);
        }
    } else throw (409);
}

async function update(user) {
    const strId = user._id;
    const pendingIn = [...user.pendingIn];
    const likes = [...user.likes];
    user._id = new ObjectId(user._id);
    user.pendingIn = user.pendingIn.map(tripId => new ObjectId(tripId))
    user.likes = user.likes.map(userId => {
        if (userId) return new ObjectId(userId)
        else return userId
    })
    try {
        const db = await mongoService.connect()
        let loadedUser = await db.collection(usersCollection).findOne({ _id: user._id })
        if (!loadedUser) {
            throw new Error(404);
        }
        if (!user.newPassword) {
            delete user.confirmPassword;
            delete user.newPassword;
            // get old hash
            user.password = loadedUser.password;
        } else {
            const isAuth = await bcrypt.compare(user.confirmPassword, loadedUser.password);
            if (isAuth) {
                try {
                    const salt = await bcrypt.genSalt(10)
                    const hashedPassword = await bcrypt.hash(user.newPassword, salt);
                    user.password = hashedPassword;
                    delete user.confirmPassword;
                    delete user.newPassword;
                } catch {
                    throw new Error(404);
                }
            } else throw new Error(401);
        }
        await db.collection(usersCollection).updateOne({ _id: user._id }, { $set: user })

        user._id = strId;
        user.pendingIn = pendingIn;
        user.likes = likes;
        delete user.password;
        console.log('user to return: ', user);

        return user;
    } catch (err) {
        throw err;
    }
}

async function updateLikesToUser(userId, like) {
    let { likingUserId, action } = like;
    userId = new ObjectId(userId);
    likingUserId = new ObjectId(likingUserId);
    try {
        const db = await mongoService.connect()
        if (action === 'like') {
            const res = await db.collection(usersCollection).updateOne({ _id: userId }, { $push: { likes: likingUserId } })
        } else {
            const res = await db.collection(usersCollection).updateOne({ _id: userId }, { $pull: { likes: likingUserId } })
        }
    } catch (err) {
        throw 404;
    }
}

async function updateTripToUser({ tripId, user, action }) {
    const objTripId = new ObjectId(tripId);
    const objUserId = new ObjectId(user._id)
    try {
        const db = await mongoService.connect()
        var user;
        console.log('action:', action);

        if (action === 'request') {
            user = await db.collection(usersCollection).updateOne({ _id: objUserId }, { $push: { pendingIn: objTripId } })
        } else if (action === 'approve') {
            user = await db.collection(usersCollection).updateOne({ _id: objUserId }, { $pull: { pendingIn: objTripId } })
            user = await db.collection(usersCollection).updateOne({ _id: objUserId }, { $push: { memberIn: objTripId } })
        } else if (action === 'remove from pending') {
            user = await db.collection(usersCollection).updateOne({ _id: objUserId }, { $pull: { pendingIn: objTripId } })
        } else { // admin can remove member after approved
            user = await db.collection(usersCollection).updateOne({ _id: objUserId }, { $pull: { memberIn: objTripId } })
        }
        return user;
    } catch {
        // TODO simon
    }
}

function remove(id) {
    const _id = new ObjectId(id);
    return mongoService.connect()
        .then(db => db.collection(usersCollection).remove({ _id }));
}