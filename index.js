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
    markNotificationsRead
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
app.post('/notifications', FBAuth, markNotificationsRead)

// https://baseurl.com/api/posts
exports.api = functions.region('europe-west1').https.onRequest(app)

// notify users
// notify on like
exports.createNotificationOnLike = functions
.region('europe-west1')
.firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        return db
        .doc(`/posts/${snapshot.data().postId}`)
            .get()
            .then(doc => {
                if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
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

// delete notification on unlike
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

// notify on a comment
exports.createNotificationOnComment = functions
.region('europe-west1')
.firestore.document('comments/{id}')
    .onCreate((snapshot) => {
        return db
        .doc(`/posts/${snapshot.data().postId}`)
            .get()
            .then(doc => {
                if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
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

// trigger to change imagerUrl of the user everywhere when image is changed
exports.changeImageUrl = functions
.region('europe-west1')
.firestore.document('/users/{userId}')
    .onUpdate((change)=>{
        if (change.before.data().imageUrl !== change.after.data().imageUrl){
            let batch = db.batch()
            return db.collection('posts').where('userHandle', '==', change.before.data().handle).get()
            .then((data)=>{
                data.forEach(doc => {
                    const post = db.doc(`/posts/${doc.id}`)
                    batch.update(post, {userImage: change.after.data().imageUrl})
                })
                return batch.commit()
            })
        }
    })

// delete post related data when post deleted
exports.onPostDeleted = functions
.region('europe-west1')
.firestore.document('/posts/{postId}')
.onDelete((snapshot, context)=>{
        const postId = context.params.postId
        const batch = db.batch()
        return db.collection('comments').where('postId', '==', postId).get()
        .then(data =>{
            data.forEach(doc => {
                batch.delete(db.doc(`/comments/${doc.id}`))
            })
            return db.collection('likes').where('postId', '==', postId).get()
        })
        .then(data => {
            data.forEach(doc =>{
                batch.delete(db.doc(`/likes/${doc.id}`))
            })
            return db.collection('notifications').where('postId', '==', postId).get()
        })
        .then(data =>{
            data.forEach(doc =>{
                batch.delete(db.doc(`/notifications/${doc.id}`))
            })
            return batch.commit()
        })
        .catch(err =>{
            return err
        })
})