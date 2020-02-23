const functions = require('firebase-functions')

const app = require('express')()

const FBAuth = require('./util/fbAuth')

const { db } = require('./util/admin')

const { 
    getAllPosts, 
    postAPost, 
    getPosts, 
    commentOnPost,
    likePost,
    unlikePost,
    deletePost
} = require('./handlers/posts')
const { 
    signUp, 
    logIn, 
    uploadImage, 
    addUserDetails, 
    getAuthenticatedUser, 
    getUserDetails,
    markNotificationRead
} = require('./handlers/users')

// Posts routes
app.get('/posts', getAllPosts)
app.post('/posts', FBAuth, postAPost)
app.get('/posts/:postId', getPosts)
app.post('/posts/:postId/comment', FBAuth, commentOnPost)
app.delete('/posts/:postId', FBAuth, deletePost)
app.get('/posts/:postId/like', FBAuth, likePost)
app.get('/posts/:postId/unlike', FBAuth, unlikePost)

// Users routes
app.post('/signup', signUp)
app.post('/login', logIn)
app.post('/user/image', FBAuth, uploadImage)
app.post('/user', FBAuth, addUserDetails)
app.get('/user', FBAuth, getAuthenticatedUser)
app.get('/user/:handle', getUserDetails)
app.post('/notifications', FBAuth, markNotificationRead)

// https://baseurl.com/api/posts
exports.api = functions.region('europe-west1').https.onRequest(app)

// notify users
exports.createNotificationOnLike = functions
.region('europe-west1')
.firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        return db
        .doc(`/posts/${snapshot.data().postId}`)
            .get()
            .then(doc => {
                if(doc.exists){
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        postId: doc.id,
                        type: 'like',
                        read: false
                    })
                }
            })
            .then(()=> {
                return
            })
            .catch(err => {
                return err
            })
})

exports.DeleteOnUnlike = functions
.region('europe-west1')
.firestore.document('likes/{id}')
.onDelete((snapshot) => {
    return db
    .doc(`/notifications/${snapshot.id}`)
        .delete()
        .then(()=> {
            return;
        })
        .catch(err => {
            return err;
        })
})

exports.createNotificationOnComment = functions
.region('europe-west1')
.firestore.document('comments/{id}')
    .onCreate((snapshot) => {
        return db
        .doc(`/posts/${snapshot.data().postId}`)
            .get()
            .then(doc => {
                if(doc.exists){
                    return db
                    .doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        postId: doc.id,
                        type: 'comment',
                        read: false
                    })
                }
            })
            .then(()=> {
                return snapshot
            })
            .catch(err => {
                return err
            })
})