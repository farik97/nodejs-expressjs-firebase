const { db } = require('../util/admin')

// get all posts
exports.getAllPosts = (req, res) =>{
    db
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .get()
            .then( data => {
                let posts = []
                data.forEach(doc => {
                    posts.push({
                        postId: doc.id,
                        body: doc.data().body,
                        userHandle: doc.data().userHandle,
                        createdAt: doc.data().createdAt,
                        commentCount: doc.data().commentCount,
                        likeCount: doc.data().likeCount,
                        userImage: doc.data().userImage
                    })
                })
                return res.json(posts)
            })
            .catch(err => console.error(err))
}

// post a post
exports.postAPost = (req, res) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({body: 'Body must not be empty'});
    }
    
    const newPost = {
        body: req.body.body,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    }
    db.collection('posts')
        .add(newPost)
        .then(doc => {
            resPost = newPost
            resPost.postId = doc.id
            res.json(resPost)
        })
        .catch(err => {
            res.status(500).json({error: 'something went wrong'})
            console.error(err)
        })
}

// get a post
exports.getPosts = (req, res) => {
    let postData = {}
    db.doc(`/posts/${req.params.postId}`).get()
        .then(doc => {
            if(!doc.exists){
                return res.status(404).json({error: 'post not found'})
            }
            postData = doc.data()
            postData.postId = doc.id
            return db.collection('comments').orderBy('createdAt', 'desc').where('postId', '==', req.params.postId).get()
        })
        .then(data => {
            postData.comments = []
            data.forEach(doc => {
                postData.comments.push(doc.data())
            })
            return db.collection('likes').where('postId', '==', postData.postId).get()
        })
        .then(data => {
            postData.likes = []
            data.forEach(doc => {
                postData.likes.push({
                    userHandle: doc.data().userHandle,
                    postId: doc.data().postId
                })
            })
            return res.json(postData)
        })
        .catch(err => {
            res.status(500).json({error: err.code})
        })
}

// comment on a post
exports.commentOnPost = (req, res) => {
    if (req.body.body.trim() === '') return res.status(400).json({error: 'comment must not be empty'})
    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        postId: req.params.postId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
    }
    db.doc(`/posts/${req.params.postId}`)
        .get()
        .then(doc => {
            if(!doc.exists){
                return res.status(404).json({error: 'post does not exist'})
            } 
            return doc.ref.update({commentCount: doc.data().commentCount + 1})
        })
        .then(()=>{
            return db.collection('comments').add(newComment)
        })
        .then(doc => {
            res.status(200).json({newComment})
        })
        .catch(err =>{
            res.status(500).json({err: `this is the error: ${err}`})
        })
}

// like a post
exports.likePost = (req, res) => {
    const likeDocument = db
        .collection('likes')
        .where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId)
        .limit(1);

    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData;

    postDocument
        .get()
        .then((doc) => {
        if (doc.exists) {
            postData = doc.data();
            postData.postId = doc.id;
            return likeDocument.get();
        } else {
            return res.status(404).json({ error: 'post not found' });
        }
        })
        .then((data) => {
        if (data.empty) {
            return db
            .collection('likes')
            .add({
                postId: req.params.postId,
                userHandle: req.user.handle
            })
            .then(() => {
                postData.likeCount++;
                return postDocument.update({ likeCount: postData.likeCount });
            })
            .then(() => {
                return res.json(postData);
            });
        } else {
            return res.status(400).json({ error: 'post already liked' });
        }
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });
}

// unlike a post
exports.unlikePost = (req, res) => {
    const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('postId', '==', req.params.postId)
    .limit(1);

  const postDocument = db.doc(`/posts/${req.params.postId}`);

  let postData;

  postDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        postData = doc.data();
        postData.postId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Post not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: 'Post not liked' });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            postData.likeCount--;
            return postDocument.update({ likeCount: postData.likeCount });
          })
          .then(() => {
            res.json(postData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
}

// delete a post
exports.deletePost = (req, res) => {
    const postDocument = db.doc(`/posts/${req.params.postId}`)
    postDocument.get()
    .then(doc => {
        if(!doc.exists){
            return res.status(404).json({'error': 'sorry document doesnt exist'})
        }
        if(doc.data().userHandle !== req.user.handle){
            return res.status(403).json({'error': 'you cannot delete other peoples posts, stop it :('})
        } else {
            return postDocument.delete()
        }
    })
    .then(()=>{
        res.status(200).json({message: 'post deleted'})
    })
    .catch(err => {
        return res.status(500).json({'error': `this is the error: ${err}`})
    })
}