## What Is Serverless ⚡️

Serverless is a framework that we use to build, test and deploy serverless applications in a streamlined and standardised manner. One of the good things is that it is provider agnostic, so not only on AWS but azure and google cloud as well.

Serverless abstracts away the most menial parts of building an application, leaving developers free to actually spend their days coding.

What this means is that developers can single-handedly build apps that handle production-ready traffic. They don’t have to actively manage scaling for their applications. They don't have to provision servers, or pay for resources that go unused. They can just get projects off the ground with small, agile teams.

So today we are going to setup a serverless API to save notes. We will setup lambda functions to save the notes in a dynamodb table and we will expose the lambdas as restful endpoints with API gateway.


### Setup

Installing Serverless framework

```
npm install -g serverless
```

To check the version
```
sls -v
``` 
---
&nbsp;

## Let's Start 🛠

Let's make a serverless application

``` 
mkdir serverless-app 

cd serverless-app

sls create --template aws-nodejs -n <your-name-here>-serverless-api

```

### Deploy 🚀

Let's deploy this to AWS

```
saml2aws login

export AWS_PROFILE="domain-sandbox"

aws s3 ls

serverless deploy
```

Now let's login to the console and look at what we setup

### Remove the stack

If we need to remove a stack it's as easy as...
``` 
sls remove
```
### Update the region and stage

#### **`serverless.yml`**
```yaml
provider:
  name: aws
  runtime: nodejs10.x
  region: ap-southeast-2
  stage: dev
```
and deploy again

```
sls deploy
```

---
&nbsp;

## Exposing our lambda function

Now let's expose our lambda function with a API gateway endpoint

#### **`serverless.yml`**
```yaml
functions:
  hello:
    handler: handler.hello
    events:
      - http:
          path: hello
          method: get
          cors: true
```

Now let's deploy

`sls deploy`

---
&nbsp;

## Specifying config at the provider level ⚙️

#### **`serverless.yml`**
```yaml
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
```
---
&nbsp;

## Plugins 🔌

let's add a plugin to test offline

```
npm init -y

yarn add --dev serverless-offline
```


#### **`serverless.yml`**
```yaml
plugins:
  - serverless-offline
```
Then run in the terminal
```
sls offline
```

Now test on localhost:3000

---
&nbsp;

## Setting up a dynamoDb 🗂

We setup our dynamo db in serverless.yml

#### **`serverless.yml`**
```yaml
resources:
  Resources:
    NotesTable:
      Type: AWS::DynamoDB::Table
      DeletionPolicy: Delete
      Properties:
        TableName: ${self:provider.environment.NOTES_TABLE}
        AttributeDefinitions:
          - AttributeName: user_id
            AttributeType: S
          - AttributeName: timestamp
            AttributeType: N
        KeySchema:
          - AttributeName: user_id
            KeyType: HASH
          - AttributeName: timestamp
            KeyType: RANGE
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1
```
Let's add environment variable at the provider level

```yaml
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
  environment: 
    NOTES_TABLE: ${self:service}-${opt:stage, self:provider.stage}
```
Now let's deploy

`sls deploy`

We can check in AWS console to see the table

---
&nbsp;

## Adding the handlers for our functions

Now let's add the handlers to interact with our DB

We need to install our dependencies
```
yarn add aws-sdk moment uuid
```

So we can make a directory of handlers, add the following file

`serverless-app/handlers/add-note.js`

Then we can write some boilerplate code

#### **`handlers/add-note.js`**
```javascript
const AWS = require('aws-sdk');
AWS.config.update({ region: 'ap-southeast-2' });

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.NOTES_TABLE;

exports.handler = async (event) => {
    try {
        return {
            statusCode: 200,
            body: JSON.stringify()
        };
    } catch (err) {
        console.log("Error", err);
        return {
            statusCode: err.statusCode ? err.statusCode : 500,
            body: JSON.stringify({
                error: err.name ? err.name : "Exception",
                message: err.message ? err.message : "Unknown error"
            })
        };
    }
}
```
Let's finish off the code

#### **`handlers/add-note.js`**
```javascript
/**
 * Route: POST /note
 */

const AWS = require('aws-sdk');
AWS.config.update({ region: 'ap-southeast-2' });

// let's add our packages
const moment = require('moment');
const uuidv4 = require('uuid/v4');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.NOTES_TABLE;

exports.handler = async (event) => {
    try {
        let item = JSON.parse(event.body).Item;
        item.user_id = util.getUserId(event.headers);
        item.user_name = util.getUserName(event.headers);
        item.note_id = item.user_id + ':' + uuidv4()
        item.timestamp = moment().unix();

        let data = await dynamodb.put({
            TableName: tableName,
            Item: item
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify(item)
        };
    } catch (err) {
        console.log("Error", err);
        return {
            statusCode: err.statusCode ? err.statusCode : 500,
            headers: util.getResponseHeaders(),
            body: JSON.stringify({
                error: err.name ? err.name : "Exception",
                message: err.message ? err.message : "Unknown error"
            })
        };
    }
}
```
---
&nbsp;

## Adding IAM permissions

Now our lambda handlers are going to need appropriate permissions to interact with our dynamo db

#### **`serverless.yml`**
```yaml
provider:
  name: aws
  runtime: nodejs10.x
  region: ap-southeast-2
  stage: dev
  memorySize: 128
  timeout: 3
  environment: 
    NOTES_TABLE: ${self:service}-${opt:stage, self:provider.stage}
  iamRoleStatements:
    - Effect: Allow
      Action: 
        - dynamodb:Query
        - dynamodb:PutItem
      Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.NOTES_TABLE}"
```
---
&nbsp;

## Adding the lambda handlers to serverless.yml

Now we are ready to define our lambda functions and the corresponding endpoints.
We are going to have some functions to define in serverless.yml

#### **`serverless.yml`**
```yaml
functions:
  add-note:
    handler: add-note.handler
    description: POST /note
    events:
      - http:
          path: note
          method: post
          cors: true
```
Now we can test the application locally with serverless-offline

`sls offline`

We can test with the following request
```
POST localhost:3000/note
Content-Type: application/json
{
	"Item": {
		"user_id": "id1",
		"user_name": "name",
		"title": "my note",
		"content": "Serverless rocks",
		"cat": "general"
	}
}
```
---
&nbsp;

# WE ARE DONE!! YOU ROCK 🎸🤘🎉

## More resources

[fe-lambda-boilerplate-generator](https://github.com/domain-group/fe-lambda-boilerplate-generator)


