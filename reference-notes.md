### Welcome

### What is serverless

Serverless is a framework that we use to build, test and deploy serverless applications in a streamlined and standardised manner. One of the good things is that it is provider agnostic, so not only on AWS but azure and google cloud as well.

Serverless abstracts away the most menial parts of building an application, leaving developers free to actually spend their days coding.

What this means is that developers can single-handedly build apps that handle production-ready traffic. They don’t have to actively manage scaling for their applications. They don't have to provision servers, or pay for resources that go unused. They can just get projects off the ground with small, agile teams.

So today we are going to setup a serverless API to save notes. We will setup lambda functions to save the notes in a dynamodb table and we will expose the lambdas as restful endpoints with API gateway.

I have added some notes to the workshop outlining what we are going to do today. So everyone can code along if you want, or if you prefer to copy paste the code as we go you can do that as well.

Frank and Thuan are going to be helping out if anyone gets stuck along the way

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

### Explain the basics
- So now we have the serverless.yml which defines our application.
serverless yaml defines
- the provider the service will be deployed to (and the runtime if provided)
- one or more functions in the service
- events that trigger each function to execute (e.g. HTTP requests)
- a set of resources (e.g. 1 DynamoDB table) required by the functions in this service

- when we deployThe Serverless Framework translates all syntax in serverless.yml to a single AWS CloudFormation template 
- zips the functions

lets remove the commented out code

we can see the service name is 

we can see the provider

we can see the function which is handler.hello 

ensure that the indentation is correct because the yaml file is sensitive to that

### Deploy

lets deploy this

first we need to update the region

#### **`serverless.yml`**
```yaml
provider:
  name: aws
  runtime: nodejs10.x
  region: ap-southeast-2
  stage: dev
```
now we can login to aws and deploy

```
saml2aws login

export AWS_PROFILE="domain-sandbox"

serverless deploy
```
now lets go to aws and look at cloudformation to see what was generated

### Expose our lambda function

now lets expose our lambda function with a API gateway endpoint

now we need to add an api gateway event trigger in serverless.yml

#### **`serverless.yml`**
```yaml
functions:
  hello:
    handler: handler.hello
# in the events we specify what events we want to trigger the function, 
# this can be things like s3 bucket uploads or an sns topic
# in this case we just want one api gateway event. 
    events:
    # because we are doing api gateway then we specify http, then under that we provide the event properties.
    # we need to specify an array or list
      - http:
        # specify the path
          path: hello
          # get request.
          method: get
          # Lets set cors true which will automatically set the cors headers for the method and also create the options method for the preflight request
          cors: true
```
so now when we deploy this serverless will deploy any infrastructure required for an event
and configure the function to listen to it

now lets deploy

if we go to api gateway we should see the new service

let test the endpoint by sending a get request

so serverless sets some defaults for the functions that we can overide. we can specify common properties at the provider level or at the function level

#### **`serverless.yml`**
```yaml
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
```

### Plugins

Plugins are custom bits of code that extend the functionality of the serverless framework. 

theres one very popular plugin that lets us test our serverless stack locally

specifically serverless-offline plugin emulates AWS λ and API Gateway on your local machine to speed up your development

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
# now lets define the dynamoDB table and we do this in the resources section
# what goes in this section is raw cloudformation syntax
resources:
  Resources:
# we set the name as our reference
    NotesTable:
      Type: AWS::DynamoDB::Table
# we set deletion policy so if the stack gets removed we keep the data. 
      DeletionPolicy: Delete
# properties sets the table name from the env variable
      Properties:
      # we need a table name and im going to come back to this
        TableName: ${self:provider.environment.NOTES_TABLE}
        # then we have attribute definititions. we specify the key attributes to be used for primary keys.
  # for this notes table we can have userid as a primary key. 
  # so we need to define all these attributes an array
        AttributeDefinitions:
    # - user_id is string
          - AttributeName: user_id
            AttributeType: S
    # then define the primary key with key schema
    # attribute name is user_id
        KeySchema:
          - AttributeName: user_id
    # and key type is hash to indicate a partition key
            KeyType: HASH
    # then define provisioned throughput:
    #   Readcapacity unit and write capacity this is the value of how many reads and writes per second
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1
```
```yaml
    # Now you can imagine we may want to have different table for development and prod. - So serverless lets us use variables to dyamnically change the values in the config. variables are also great for stroing secret keys 
    # lets jump up to set some environment variableas
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
  # so in the provider section we set environment
  environment: 
  # lets give the table name a parameterized name
  # then we set notes table and self refernce the serverless.yml
    NOTES_TABLE: ${self:service}-${self:provider.stage}
```
now lets deploy

then check its in AWS

### Add the handlers
now lets add the handlers to interact with our DB

lets create a file
- add-note.js

we need to install our dependencies
```
yarn add aws-sdk uuid
```

#### **`add-note.js`**
```javascript
// lets reference the AWS SDK
const AWS = require('aws-sdk');
// - setup the region
AWS.config.update({ region: 'ap-southeast-2' });

// - instantiate a dynamo db class
const dynamodb = new AWS.DynamoDB.DocumentClient();
// - get the table name from .env
const tableName = process.env.NOTES_TABLE;

// - write the lambda handler
exports.handler = async (event) => {
    try {
// we have to return an http response as we are using the default lambda proxy integration. so we return a response object
// lambda proxy integration automaticlly passes the content of the http request to the function and allows you to configure your response
        return {
            statusCode: 200,
// - so we can add our body
            body: JSON.stringify()
        };
    } catch (err) {
        console.log("Error", err);
        return {
            statusCode: err.statusCode ? err.statusCode : 500,
            body: JSON.stringify({
                message: "error"
            })
        };
    }
}
```

so now lets finish off our add note handler
- this will be a post route and will receive the user data or item attributes in the http request body
- now lets capture the user data from the incoming request and store that data as a new item in our dynamo db

our final code looks like this
#### **`add-note.js`**
```javascript
/**
 * Route: POST /note
 */

const AWS = require('aws-sdk');
AWS.config.update({ region: 'ap-southeast-2' });

// lets add our packages
const uuidv4 = require('uuid/v4');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.NOTES_TABLE;

exports.handler = async (event) => {
    try {
// - we can get the data from the event.body and we need to JSON parse it
        let item = JSON.parse(event.body);
// - lets setup a unique id for the notes
        item.note_id = uuidv4()
// - now to insert this into the table we can call the put method on the document client class
        let data = await dynamodb.put({
// - so we pass the table name and the item 
            TableName: tableName,
            Item: item
            // then convert it into a promise
        }).promise();

        return {
            statusCode: 200,
// - the put method does not return anything on sucess so we can simply return the item object
            body: JSON.stringify(item)
        };
    } catch (err) {
        console.log("Error", err);
        return {
            statusCode: err.statusCode ? err.statusCode : 500,
            body: JSON.stringify({
                message: "error"
            })
        };
    }
}
```

### Add IAM roles

- now our lambda handlers are going to need appropriate permissions to interact with our dynamo db
- we can specify IAM roles at the provider level. We can specify the permissions at the function level but first we would have to create the appropriate roles first and then assign their arns inside the function properties. Instead of the we will specify IAM role statements at the provider level. These role statements will be applied to all functions in the file

code is now this
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
    NOTES_TABLE: ${self:service}-${self:provider.stage}
# - we can add multiple role statements as an array
  iamRoleStatements:
# - we can say effect allow, then the allowed actions so query put and delete
    - Effect: Allow
      Action: 
        - dynamodb:PutItem
# - resource is the arn of our table we 
      Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.NOTES_TABLE}"
```

### Add the lambda handlers to serverless.yml

now we are ready to define our lambda function and the corresponding endpoint
Let's define the function in serverless.yml

#### **`serverless.yml`**
```yaml
functions:
# - add-note add the handler
  add-note:
    handler: add-note.handler
# - description
    description: POST /note
# - list the events 
    events:
# - first http
      - http:
# - path note
          path: note
# - method post
          method: post
          cors: true
```
- now we can test the application locally with serverless-offline
- sls offline
- if we get a response back it should be good
- now lets look in the dynamo db table and it should be there

we can test with the following request
```
POST localhost:3000/note

{
	"user_id": "id1",
	"user_name": "name",
	"title": "my note",
	"content": "Serverless rocks"
}
```

and we can check in our dynamoDbto make sure that the data is there

