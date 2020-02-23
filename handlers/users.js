const { admin, db} = require('../util/admin')

const config = require('../util/config')

const firebase = require('firebase')
firebase.initializeApp(config)

const { validateSignupData, validateLoginData, reduceUserDetails } = require('../util/validators')

// signup
exports.signUp = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    }

    const { valid, errors} = validateSignupData(newUser)
    
    if(!valid) return res.status(400).json(errors)

    const noImg = 'default_account.png'

    let token, userId;
    db.doc(`/users/${newUser.handle}`)
        .get()
        .then((doc) => {
            if (doc.exists) {
                return res.status(400).json({handle: 'this handle is already taken'});
            }   else {
                 return firebase
                    .auth()
                    .createUserWithEmailAndPassword(newUser.email, newUser.password)
            }   
        })
        .then((data) => {
            userId = data.user.uid;
            return data.user.getIdToken()
        })
        .then((idToken) => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCredentials)
        })
        .then(() => {
            return res.status(201).json({token});
        })
        .catch( (err) => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use'){
                return res.status(400).json({email: 'Email is already in use'})
            } else {
                return res.status(500).json({error: err.code});
            }
        })
}

// login
exports.logIn = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password,
    }
    
    const { valid, errors} = validateLoginData(user)
    
    if(!valid) return res.status(400).json(errors)
    
    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken()
        })
        .then(token => {
            return res.json({token})
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/wrong-password') {
                return res
                    .status(403)
                    .json({general: 'Wrong credentials, please try again'});
            } else return res.status(500).json({error: err.code});
        })
}

// add user details
exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body)
  
  db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(()=>{
      return res.json({message: 'details added succesfully'})
    })
    .catch(err => {
      console.error(err)
      return res.status(500).json({error: err.code})
    })
}

// get own user details
exports.getAuthenticatedUser = (req, res) => {
  let userData = {}
  db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
      if(doc.exists){
        userData.credentials = doc.data()
        return db.collection('likes').where('userHandle', '==', req.user.handle).get()
      }
    })
    .then(data => {
      userData.likes = []
      data.forEach(doc => {
        userData.likes.push(doc.data())
      })
      return db.collection('notifications').where('recipient', '==', req.user.handle)
        .orderBy('createdAt', 'desc').limit(10).get()
    })
    .then(data => {
      userData.notifications = []
      data.forEach(doc => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          read: doc.data().read,
          postId: doc.data().postId,
          createdAt: doc.data().createdAt,
          notificationId: doc.id
        })
      })
      return res.json(userData)
    })
    .catch(err => {
      return res.status(500).json({error: err.code})
    })
}

// Upload a profile image for user
exports.uploadImage = ( req, res ) => {
  var BusBoy = require('busboy')
  var path = require('path')
  var os = require('os')
  var fs = require('fs')

  var busboy = new BusBoy({headers: req.headers})

  var imageFileName
  var imageToBeUploaded = {}

  busboy.on('file', (fieldname, file, filename, mimetype, encoding) => {
    console.log(fieldname, file, filename, encoding)
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ error: 'Wrong file type submitted' });
    }
    
    //image.png
    const imageExtension = filename.split('.')[filename.split('.').length -1]
    
    //645484654184435.png
    imageFileName = `${Math.round(Math.random()*100000000000)}.${imageExtension}`
    var filepath = path.join(os.tmpdir(), imageFileName)
    imageToBeUploaded = { filepath, mimetype }
    file.pipe(fs.createWriteStream(filepath))
  })
  busboy.on('finish', ()=> {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false, 
        metadata:{
          metadata: {
            contentType: imageToBeUploaded.mimetype
          }
        }
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`
        return db.doc(`/users/${req.user.handle}`).update({ imageUrl })
      })
      .then(() => {
        return res.json({message: 'Image uploaded successfully'})
      })
      .catch((err) => {
        console.error(err)
        return res.status(502).json({error})
      })
  })
  busboy.end(req.rawBody)
}

// get any users details
exports.getUserDetails = (req, res) => {
  let userData = {}
  userHandle = req.params.handle
  db.doc(`/users/${userHandle}`).get()
  .then(doc => {
    if(doc.exists){
      userData.user = doc.data()
      return db.collection('posts').where('userHandle', '==', req.params.handle).orderBy('createdAt', 'desc').get()
    } else {
      return res.status(404).json({'error': 'user not found'})
    }
  })
  .then(data => {
    userData.posts = []
    data.forEach(doc => {
      userData.posts.push({
        body: doc.data().body,
        commentCount: doc.data().commentCount,
        createdAt: doc.data().createdAt,
        likeCount: doc.data().likeCount,
        userHandle: doc.data().userHandle,
        postId: doc.id
      })
    })
    return res.json(userData)
  })
  .catch(err => {
    return res.status(500).json({'error': `something went wrong error: ${err.code}`})
  })
}

exports.markNotificationsRead = (req, res) => {
  let batch = db.batch()
  req.body.forEach(notificationId => {
    const notification = db.doc(`/notifications/${notificationId}`)
    batch.update(notification, {read: true})
  })
  batch.commit()
  .then(()=> {
    return res.status(200).json({'message': 'notifications marked read'})
  })
  .catch(err => {
    return res.status(500).json({'error': `this is the error: ${err.code}`})
  })
}

