### What is serverless

Serverless is a framework that we use to build, test and deploy serverless applications in a streamlined and standardised manner. One of the good things is that it is provider agnostic, so not only on AWS but azure and google cloud as well

installing serverless

```
yarn add -g serverless
```

to check the version
```
sls -v
``` 

lets make an application

``` 
mkdir serverless-app 

sls create --template aws-nodejs -n hello-serverless

```
So now we have the serverless.yml which defines our application. Need to talk about how cloudformation templates can be used in this file.

we can see the service name is 

we can see the provider

we can see the function which is handler.hello

we can look at commented out sections
- we can have a stage and region
- we can have IAM roles for the lambda
- you can add the environment variables
- we can specify the events

so we can remove this commented code
ensure that the indentation is correct because the yaml file is sensitive to that

let deploy this

### WHAT IS THE LOGIN STEPS FOR SANDBOX

```
sls deploy
```

now lets go to aws and look at cloudformation to see what was generated

the region was wrong so we can fix this
``` 
sls remove
```
now make adjustments and deploy again

```
provider:
  name: aws
  runtime: nodejs10.x
  region: ap-southeast-2
  stage: dev
```

we can overide the stage by passing the stage flag so we can deploy to the prod stack

```
sls deploy --stage prod
```

now we can check the stack again

now lets add another lambda function and expose it with a API gateway endpoint

### WHERE ARE THE DOCS ON THE EVENT OBJECTS

```
// event.body comes in as a JSON string
module.exports.add = async (event) => {
  const {num1, num2} = JSON.parse(event.body)
  return {
    statusCode: 200,
    body: JSON.stringify({
      num1,
      num2,
      result: num1 + num2
    }),
  };
};
```

now we need to add an api gateway event trigger
in the events we specify what events we want to trigger the function, in this case we just want one api gateway event. we need to specify an array or list, then we specify http, then under that we provide the event properties. specify the path and then because we are sending the data in the request body the method should be post. Lets set cors true which will automatically set the cors headers for the method and also create the options method for the preflight request

```
functions:
  hello:
    handler: handler.hello

  add:
    handler: add.add
    events:
      - http:
          path: math/add
          method: post
          cors: true
```

now lets deploy

if we go to api gateway we should see the new service

let test the endpoint with postman by sending a post request

so serverless sets some defaults for the functions that we can overide. we can specify common properties at the provider level

```
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
```

### DO I NEED TO DISCUSS VPC

Plugins enhance or addon to the core functionality let add serverless offline plugin to run and test the API locally without having to deploy

```
npm init

yarn add -dev serverless-offline
```
add to serverless.yml
```
plugins:
  - serverless-offline
```
then run 
`sls offline`


now lets setup our dynamo db
`yarn add aws-sdk`

we need to add the environment variable for the table name so we can give it a parameterized name
```
provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  timeout: 3
  environment: 
    NOTES_TABLE: ${self:service}-${opt:stage, self:provider.stage}
```

now lets define the dynamDB table and we do this in the resources section
we set the name as our reference
we set deletion policy so if the stack gets removed we kee the data. 
properties sets the table name from the env variable
then we have attribute definititions. we specify the key attributes to be used for primary and secondary keys.
for this notes table we can have userid and timestamp as primary key and we can have a global secondary index on the note attribute. so we need to define all these attributes as a list or array
- user_id is string
- timestamp is number
- note_id is string
then define the primary key with key schema
attribute name is user_id
and key type is hash to indicate a partition key
define the sort key with attribute name timestamp and key type range
then define provisioned throughput:
  Readcapacity unit and write capacity
then define the global secondary indexthen add a list of indexes
we only want 1 index note_id-index
then we have keychema with attribute name note_id
key type hash
so we only have a partition key in this index
we are not using a sort key or a range key here
secondary indexes have a projection type and we will set the projection type to all this will project all the item attributes to this index
and since this is a global secondary index it will have its own provisoned throughput 

```
resources:
  Resources:
    NotesTable:
      Type: AWS::DynamoDB::Table
      DeletionPolicy: Retain
      Properties:
        TableName: ${self:provider.environment.NOTES_TABLE}
        AttributeDefinitions:
          - AttributeName: user_id
            AttributeType: S
          - AttributeName: timestamp
            AttributeType: N
          - AttributeName: note_id
            AttributeType: S
        KeySchema:
          - AttributeName: user_id
            AttributeType: HASH
          - AttributeName: timestamp
            AttributeType: RANGE
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1
        GlobalSecondaryIndexes:
          - IndexName: note_id-index
            KeySchema:
              - AttributeName: note_id
                KeyType: HASH
            Projection:
              ProjectionType: ALL
            ProvisionedThroughput:
              ReadCapacityUnits: 1
              WriteCapacityUnits: 1
```

now lets deploy

now lets add the handlers to interact with our DB

so me can make a directory of handlers
- add-note.js
- get-note.js
- get-notes.js
- update-note.js
- delete-note.js

so if we start with the add note
- lets referecne the AWS SDK
- setup the region
- insatntiate a dynamo db class
- get the table name from .env
- write the lambda handler
- we have to return an http response as we are using the default lambda proxy integration. so we return a response object
- so we can add our body
- we need to add headers so let add it as a util function
```
const getResponseHeaders = () => {
  return {
    'Access-Control-Allow-Origin': '*'
  }
}

module.exports = { getResponseHeaders }
```
- then we use it in our handler
- then lets write our response 
- now we have boilerplate code which looks like this
- we can paste this code across all the other handlers
```
const AWS = require('aws-sdk');
AWS.config.update({ region: 'ap-southeast-2	' });

const util = require('./util.js');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.NOTES_TABLE;

exports.handler = async (event) => {
    try {

        return {
            statusCode: 200,
            headers: util.getResponseHeaders(),
            body: JSON.stringify('')
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
so now lets finish off our add note handler
- this will be a post route and will receive the user data or item attributes in the http request body
- the userid might send the user iinformation in the request headers rather than the request body
- lets write a function to get this information from the request headers
- getUserID function and getUserName and we can call these whatever we want in the header
- so now our utils look like this
```
const getUserId = (headers) => {
    return headers.app_user_id;
}

const getUserName = (headers) => {
    return headers.app_user_name;
}

const getResponseHeaders = () => {
    return {
        'Access-Control-Allow-Origin': '*'
    }
}

module.exports = {
    getUserId,
    getUserName,
    getResponseHeaders
}
```
- now lets capture the user data from the incoming request and store that data as a new item in our dynamo db
- we can get the data from the event.body and we need to JSON parse it
- we can get the user id from the headers(after passing it to the function) and add it to the item
- similarly we can do the same thing with the user_name
- let also setup a unique id for the notes
- lets setup a timestamp aswell and remember we have timestamp setup as the sort key for our table
- we can set the note_id as the user_id concatenated with a colon and a uuid
- note_id is the partition key of our global secondary index in the table so adding the primary partition key (the user_id) within this note_id can be helpful if we want to set a fine grained access control on the global secondary index
- now to insert this into the table we can call the put method on the document client class
- so we pass the table name and the item then convert it into a promise
- the put method does not return anything on sucess so we can simply return the item object
- so that is our add note function done




our final code looks like this
```
/**
 * Route: POST /note
 */

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

const moment = require('moment');
const uuidv4 = require('uuid/v4');
const util = require('./util.js');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.NOTES_TABLE;

exports.handler = async (event) => {
    try {
        let item = JSON.parse(event.body).Item;
        item.user_id = util.getUserId(event.headers);
        item.user_name = util.getUserName(event.headers);
        item.note_id = item.user_id + ':' + uuidv4()
        item.timestamp = moment().unix();
        item.expires = moment().add(90, 'days').unix();

        let data = await dynamodb.put({
            TableName: tableName,
            Item: item
        }).promise();

        return {
            statusCode: 200,
            headers: util.getResponseHeaders(),
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

- now if we have time lets write our update note handler
- its the same as the add note handler but inside the put method we use a condtition expression so that we only update if the record exists
- so we add the #t = :t variables
- then we define our variables using the expression attribute names and the expression attribute values
- so #t corresponds to the name of the variable to compare which is timestamp
- similarly :t corresponds to the value of the variable and we can get the value of the timestamp from the value of the timestamp
- then we convert it to a promise
- finally we return the updated item data in the http response
- the final code looks like this
```
/**
 * Route: PATCH /note
 */

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

const moment = require('moment');
const util = require('./util.js');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.NOTES_TABLE;

exports.handler = async (event) => {
    try {
        let item = JSON.parse(event.body).Item;
        item.user_id = util.getUserId(event.headers);
        item.user_name = util.getUserName(event.headers);
        item.expires = moment().add(90, 'days').unix();

        let data = await dynamodb.put({
            TableName: tableName,
            Item: item,
            ConditionExpression: '#t = :t',
            ExpressionAttributeNames: {
                '#t': 'timestamp'
            },
            ExpressionAttributeValues: {
                ':t': item.timestamp
            }
        }).promise();

        return {
            statusCode: 200,
            headers: util.getResponseHeaders(),
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

- now lets do the get notes handler
- we need 2 things the start key and the limit or the number of items to read at a time
- first we capture the query from the event
- then limit is the query or set the default limit to the 
- then we specify the params
- table name
- the keyCOnditionalExpression, this is like the where clause for the query so we can say user_id = :uid
- we define the value of :uid using expression attribute values 
- :uid = user_id
- limit is limit
- set scanIndexforward to return the data sorted in decending order of the sort key the sort key in our case is the timestamp
- we also need one more parameter the start timestamp
- so if we are querying the second page we need to pass a start key
- lets set the startTimestamp if passed otherwise we can set to 0
- then we can say if we have a positive and non-zero timestamp we can add that to the params object with params.exclusiveStartKey equal to an object and here we pass the primary key of the table index so userid andstart timestamp
- finally we call the query method of the document client class. then return the data in the http response

our final code looks like this
```
/**
 * Route: GET /notes
 */

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

const util = require('./util.js');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.NOTES_TABLE;

exports.handler = async (event) => {
    try {
        let query = event.queryStringParameters;
        let limit = query && query.limit ? parseInt(query.limit) : 5;
        let user_id = util.getUserId(event.headers);

        let params = {
            TableName: tableName,
            KeyConditionExpression: "user_id = :uid",
            ExpressionAttributeValues: {
                ":uid": user_id
            },
            Limit: limit,
            ScanIndexForward: false
        };

        let startTimestamp = query && query.start ? parseInt(query.start) : 0;

        if(startTimestamp > 0) {
            params.ExclusiveStartKey = {
                user_id: user_id,
                timestamp: startTimestamp
            }
        }

        let data = await dynamodb.query(params).promise();

        return {
            statusCode: 200,
            headers: util.getResponseHeaders(),
            body: JSON.stringify(data)
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

so we can define our resources in our serverless.yml

- first we need serverless-offline
- now our lambda handlers are going to need appropriate permissions to interact with our dynamo db
- we can specify IAM roles at the provider level. We can specify the permissions at the function level but first we would have to create the appropriate roles firstand then assign their arns inside the function properties. Instead of the we will specify IAM role statements at the provider level. These role statements will be applied to all functions in the file
- we can add multiple role statements as an array
- we can say effect allow, then the allowed actions so query put and delete
- resource is the arn of our table we 

code in now this
```
provider:
  name: aws
  runtime: nodejs8.10
  region: us-west-2
  stage: prod
  memorySize: 128
  timeout: 5
  endpointType: regional
  environment:
    NOTES_TABLE: ${self:service}-${opt:stage, self:provider.stage}
  iamRoleStatements:
    - Effect: Allow
      Action: 
        - dynamodb:Query
        - dynamodb:PutItem
        - dynamodb:DeleteItem
      Resource: "arn:aws:dynamodb:${opt:region, self:provider.region}:*:table/${self:provider.environment.NOTES_TABLE}"
```

now we are ready to define our lambda functions and the corresponding endpoints
- we are going to have some functions to define in serverless.yml
- add-note, get-notes, lets define them 1 by 1
- add-note add the handler
- description
- list the events 
- first http
- path note
- method post
- cors, we have to tell the api gateway to allow these special headers on the incoming request
- first set origin to * to allow all origins to make a request
- then we can add headers lets set a custom property called allowedHeaders and set the allowed headers
- we can then reference the custom property
- we can then copy the properties under the other functions
- update the handlers, descriptions and methods
- now we can test the application locally with serverless-offline
- sls offline
- so if we look at the handler we can see what we need the request body to look like and we need to pass the request headers
- if we get a response back it should be good
- now lets look in the dynamo db table and it should be there
- we we get all notes we can look at last evaluated key if we want to do pagination