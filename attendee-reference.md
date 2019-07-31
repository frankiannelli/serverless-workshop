### What is serverless

Serverless is a framework that we use to build, test and deploy serverless applications in a streamlined and standardised manner. One of the good things is that it is provider agnostic, so not only on AWS but azure and google cloud as well.

### setup

check everyone is setup

```
npm install -g serverless
```

to check the version
```
sls -v
``` 

### start

lets make a serverless application

``` 
mkdir serverless-app 

cd serverless-app

sls create --template aws-nodejs -n <your-name-here>-serverless-api

```

### Deploy

Lets deploy this

```
saml2aws login -a default

export AWS_PROFILE="domain-sandbox"

serverless deploy
```

### Remove the stack
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

### Expose our lambda function

Now lets expose our lambda function with a API gateway endpoint

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

now lets deploy

### Specifying congi at the provider level

#### **`serverless.yml`**
```yaml
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
```

### Plugins

Lets add a plugin to test offline

```
npm init -y

yarn add --dev serverless-offline
```


#### **`serverless.yml`**
```yaml
plugins:
  - serverless-offline
```
then run in the terminal
```
sls offline
```

now test on localhost:3000

### Setup dynamoDb

so let setup our dynamo db

we are going to do this in serverless.yml

#### **`serverless.yml`**
```yaml
resources:
  Resources:
    NotesTable:
      Type: AWS::DynamoDB::Table
      DeletionPolicy: Delete
      Properties:
        TableName: ${self:provider.environment.NOTES_TABLE}
```
Add the environment variable at the provider level

```yaml
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
  environment: 
    NOTES_TABLE: ${self:service}-${opt:stage, self:provider.stage}
```
no we can go back to finishing the config for the dynamo db

```yaml
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
now lets deploy

`sls deploy`

We can check in AWS console to see the table

### Add the handlers for our functions

Now lets add the handlers to interact with our DB

we need to install our dependencies
```
yarn add aws-sdk moment uuid
```

so we can make a directory of handlers

create a handlers directory

and add the following file
- add-note.js

then we can write some boilerplate code

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
Lets finish off the code

#### **`handlers/add-note.js`**
```javascript
/**
 * Route: POST /note
 */

const AWS = require('aws-sdk');
AWS.config.update({ region: 'ap-southeast-2' });

// lets add our packages
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
### Adding IAM permissions

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

### Add the lambda handlers to serverless.yml

now we are ready to define our lambda functions and the corresponding endpoints
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
- now we can test the application locally with serverless-offline
- sls offline

we can test with the following request
```
POST localhost:3000/note
Content-Type: application/json

	"Item": {
		"user_id": "id1",
		"user_name": "name",
		"title": "my note",
		"content": "contenful",
		"cat": "general"
	}
}
```

