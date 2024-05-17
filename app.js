const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const databasePath = path.join(__dirname, 'twitterClone.db')

const app = express()

app.use(express.json())

let database = null

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const convertUserDbObjectToResponseObject = dbObject => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    username: dbObject.username,
    password: dbObject.password,
    gender: dbObject.gender,
  }
}

const convertFollowerDbObjectToResponseObject = dbObject => {
  return {
    followerId: dbObject.follower_id,
    followerUserId: dbObject.follower_user_id,
    followingUserId: dbObject.following_user_id,
  }
}

const convertTweetDbObjectToResponseObject = dbObject => {
  return {
    tweetId: dbObject.tweet_id,
    tweet: dbObject.tweet,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  }
}

const convertReplyDbObjectToResponseObject = dbObject => {
  return {
    replyId: dbObject.reply_id,
    tweetId: dbObject.tweet_id,
    reply: dbObject.reply,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  }
}

const convertLikeDbObjectToResponseObject = dbObject => {
  return {
    likeId: dbObject.like_id,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  }
}

const validatePassword = password => {
  return password.length > 6
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/register/', async (request, response) => {
  const {username, name, password, gender} = request.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (name, username, password, gender)
     VALUES
      (
        '${name}',
       '${username}',
       '${hashedPassword}',
       '${gender}'
      );`
    if (validatePassword(password)) {
      await database.run(createUserQuery)
      response.send('User created successfully')
    } else {
      response.status(400)
      response.send('Password is too short')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)
  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// API-3
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const getTweetsQuery = `
   SELECT 
      *
    FROM 
      user INNER JOIN tweet ON 
      user.user_id = tweet.user_id
      ORDER BY user.user_id;

`
  const tweetObject = await database.all(getTweetsQuery)
  response.send(convertTweetDbObjectToResponseObject(tweetObject))
})

// API-4
app.get('/user/following/', authenticateToken, async (request, response) => {
  const getTweetsQuery = `
    SELECT 
      name
    FROM 
      user INNER JOIN follower ON 
      user.user_id = follower.following_user_id
      ORDER BY user.user_id;`
  const tweetObject = await database.all(getTweetsQuery)
  response.send(convertUserDbObjectToResponseObject(tweetObject))
})

// API-5
app.get('/user/followers/', authenticateToken, async (request, response) => {
  const getTweetsQuery = `
    SELECT 
      name
    FROM 
      user INNER JOIN follower ON 
      user.user_id = follower.follower_user_id
      ORDER BY user.user_id;`
  const tweetObject = await database.all(getTweetsQuery)
  response.send(convertUserDbObjectToResponseObject(tweetObject))
})

// API-6
app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const getTweetsQuery = `
    SELECT 
      *
    FROM 
      tweet INNER JOIN follower ON 
      tweet.user_id = follower.following_user_id
      WHERE tweet.tweet_id = ${tweetId};`
  const tweetObject = await database.all(getTweetsQuery)
  response.send(convertTweetDbObjectToResponseObject(tweetObject))
})

// API-7
app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const getTweetsQuery = `
    SELECT 
      name
    FROM 
      user INNER JOIN like ON 
      user.user_id = like.user_id
      WHERE like.tweet_id = ${tweetId};`
    const tweetObject = await database.all(getTweetsQuery)
    response.send(convertUserDbObjectToResponseObject(tweetObject))
  },
)

// API-8
app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const getTweetsQuery = `
    SELECT 
      name
    FROM 
      user INNER JOIN reply ON 
      user.user_id = reply.user_id
      WHERE reply.tweet_id = ${tweetId};`
    const tweetObject = await database.all(getTweetsQuery)
    response.send(convertUserDbObjectToResponseObject(tweetObject))
  },
)

//API-9
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const getTweetsQuery = `
    SELECT 
      *
    FROM 
      tweet INNER JOIN user ON 
      tweet.user_id = user.user_id;`
  const tweetObject = await database.all(getTweetsQuery)
  response.send(convertTweetDbObjectToResponseObject(tweetObject))
})

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request.body
  const postTweetQuery = `
  INSERT INTO
    tweet (tweet)
  VALUES
    ('${tweet}');`
  await database.run(postTweetQuery)
  response.send('Created a Tweet')
})

//API-11
app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const deleteTweetQuery = `
  DELETE FROM
    tweet
  WHERE
    tweet_id = ${tweetId} 
  `
    await database.run(deleteTweetQuery)
    response.send('Tweet Removed')
  },
)

module.exports = app
