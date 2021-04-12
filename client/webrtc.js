var localVideo;
var localStream;
var myName;
var remoteVideo;
var yourConn;
var uuid;
var serverConnection;
var connectionState;

var name; 
var connectedUser;

var allAvailableUsers;

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.stunprotocol.org:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};

var constraints = {
  video: true,
  audio: true
};

serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');

serverConnection.onopen = function () { 
  console.log("Connected to the signaling server"); 
};

serverConnection.onmessage = gotMessageFromServer;

document.getElementById('otherElements').hidden = true;
var usernameInput = document.querySelector('#usernameInput'); 
var usernameShow = document.querySelector('#showLocalUserName'); 
var showAllUsers = document.querySelector('#allUsers');
var remoteUsernameShow = document.querySelector('#showRemoteUserName');
var loginBtn = document.querySelector('#loginBtn');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn'); 
var hangUpBtn = document.querySelector('#hangUpBtn');

var turnOnVidBtn = document.getElementById('turnOnVid');
var turnOffVidBtn = document.getElementById('turnOffVid');

document.getElementById('remoteSnapImg').hidden = true;
document.getElementById('canvas').hidden = true;

// Login when the user clicks the button 
loginBtn.addEventListener("click", function (event) { 
  name = usernameInput.value; 
  usernameShow.innerHTML = "Hello, "+name;
  if (name.length > 0) { 
     send({ 
        type: "login", 
        name: name 
     });
  } 
 
});

function catchAllAvailableUsers(allUsers){
  allAvailableUsers = allUsers.join();
  console.log('All available users',allAvailableUsers)
  showAllUsers.innerHTML = 'Available users: '+allAvailableUsers;
}

/* START: Register user for first time i.e. Prepare ground for webrtc call to happen */
function handleLogin(success,allUsers) { 
  if (success === false) { 
    alert("Ooops...try a different username"); 
  } 
  else { 
    catchAllAvailableUsers(allUsers);
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    document.getElementById('myName').hidden = true;
    document.getElementById('otherElements').hidden = false;

  /* START:The camera stream acquisition */
  if(navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
  } else {
    alert('Your browser does not support getUserMedia API');
  }
  /* END:The camera stream acquisition */
  }
}
/* END: Register user for first time i.e. Prepare ground for webrtc call to happen */

turnOffVidBtn.addEventListener("click", function () {
  constraints.video = false;

  navigator.mediaDevices.getUserMedia(constraints).then(stopStreamedVideo).catch(errorHandler);
});

turnOnVidBtn.addEventListener("click", function() {
  constraints.video = true;

  navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
  addUserMedia();
});

function stopStreamedVideo(stream) {
  localStream = stream;
  localVideo.srcObject = null;

  yourConn.removeTrack(yourConn.getSenders().find(sender => sender.track == track));

}

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
}

function addUserMedia(){
  yourConn.ontrack = gotRemoteStream;
  //yourConn.addStream(localStream);
  localStream.getTracks().forEach(function(track) {
    yourConn.addTrack(track, localStream);
  });
}

function createPeerConnection(){
  yourConn = new RTCPeerConnection(peerConnectionConfig);

  connectionState = yourConn.connectionState;
  console.log('connection state inside getusermedia',connectionState)

  yourConn.onicecandidate = function (event) { 
    console.log('onicecandidate inside getusermedia success', event.candidate)
    if (event.candidate) { 
       send({ 
          type: "candidate", 
          candidate: event.candidate 
       }); 
    } 
  };
  addUserMedia();
}

/* START: Initiate call to any user i.e. send message to server */
callBtn.addEventListener("click", function () {
  console.log('inside call button')

  var callToUsername = document.getElementById('callToUsernameInput').value;
	
  if (callToUsername.length > 0 && allAvailableUsers.includes(callToUsername) == true && callToUsername != name) { 
    connectedUser = callToUsername; 
    console.log('nameToCall',connectedUser);
    console.log('create an offer to-',connectedUser)

    createPeerConnection()
    
    var connectionState2 = yourConn.connectionState;
    console.log('connection state before call beginning',connectionState2)
    var signallingState2 = yourConn.signalingState;
  
  //console.log('connection state after',connectionState1)
  console.log('signalling state after',signallingState2)

    
    document.getElementById('canvas').hidden = false;
    //snap
    var canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    video = document.getElementById("localVideo")
    context.drawImage(video, 0, 0, 640, 480);

    //canvas to dataUrl
    var snapUrl = canvas.toDataURL();
    send({
      type: "snap",
      snapUrl: snapUrl
    });

    yourConn.createOffer(function (offer) { 
       send({
          type: "offer", 
          offer: offer
       }); 
    
       yourConn.setLocalDescription(offer); 
    }, function (error) { 
       alert("Error when creating an offer",error); 
       console.log("Error when creating an offer",error)
    }); 
    document.getElementById('callOngoing').style.display = 'block';
    document.getElementById('callInitiator').style.display = 'none';

  } 
  else 
    alert("User Not Found !")
});
/* END: Initiate call to any user i.e. send message to server */

function gotRemoteSnapImg(snapUrl) {
  document.getElementById('remoteSnapImg').hidden = false;
  document.getElementById('canvas').hidden = true;
  var img = document.getElementById('remoteSnapImg');

  img.src = '' + snapUrl;

}

/* START: Recieved call from server i.e. recieve messages from server  */
function gotMessageFromServer(message) {
  console.log("Got message", message.data); 
  var data = JSON.parse(message.data); 
 
  switch(data.type) { 
    case "login": 
      handleLogin(data.success,data.allUsers); 
    break;
    case "joined":
      catchAllAvailableUsers(data.allUsers);
    break;
    case "snap":
      console.log('got imgUrl')
      gotRemoteSnapImg(data.snapUrl);
    break;
     //when somebody wants to call us 
    case "offer": 
      console.log('inside offer')
      handleOffer(data.offer, data.name);
    break; 
    case "answer": 
      console.log('inside answer')
      handleAnswer(data.answer); 
    break; 
     //when a remote peer sends an ice candidate to us 
    case "candidate": 
      console.log('inside handle candidate')
      handleCandidate(data.candidate); 
    break; 
    case "leave": 
      handleLeave();
      alert("Remote has disconnected !");
    break;
    default: 
      break; 
  } 

  serverConnection.onerror = function (err) { 
    console.log("Got error", err); 
  };

}

function send(msg) { 
  //attach the other peer username to our messages 
  if (connectedUser) { 
    msg.name = connectedUser; 
  } 
  console.log('msg before sending to server',msg)
  serverConnection.send(JSON.stringify(msg)); 
};

/* START: Create an answer for an offer i.e. send message to server */
function handleOffer(offer, name) { 
  document.getElementById('callInitiator').style.display = 'none';
  document.getElementById('callReceiver').style.display = 'block';

  createPeerConnection();
  
  connectedUser = name; 
  /* Call answer functionality starts */
  answerBtn.addEventListener("click", function () { 
  //connectedUser = name; 上移
  yourConn.setRemoteDescription(new RTCSessionDescription(offer)); 
 
  //create an answer to an offer 
  yourConn.createAnswer(function (answer) { 
    yourConn.setLocalDescription(answer); 
   
    send({ 
      type: "answer", 
        answer: answer 
    });
   
  }, function (error) { 
     alert("Error when creating an answer"); 
  });
  document.getElementById('remoteSnapImg').hidden = true;
  
  document.getElementById('callReceiver').style.display = 'none';
  document.getElementById('callOngoing').style.display = 'block';
});
/* Call answer functionality ends */
/* Call decline functionality starts */
declineBtn.addEventListener("click", function () {
  send({ 
    type: "leave" 
 });
 handleLeave();

});

/*Call decline functionality ends */
};

function gotRemoteStream(event) {
  console.log('got remote stream');
  remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
  console.log(error);
}

//when we got an answer from a remote user 
function handleAnswer(answer) { 
  console.log('answer: ', answer)
  yourConn.setRemoteDescription(new RTCSessionDescription(answer));
  document.getElementById('canvas').hidden = true;
};

//when we got an ice candidate from a remote user 
function handleCandidate(candidate) { 
  yourConn.addIceCandidate(new RTCIceCandidate(candidate)); 
};

//hang up
hangUpBtn.addEventListener("click", function () { 
  send({ 
     type: "leave" 
  }); 
 
  handleLeave();
});

function handleLeave() { 
  connectedUser = null; 
  remoteVideo.src = null; 
  var connectionState = yourConn.connectionState;
  var signallingState = yourConn.signalingState;
  console.log('connection state before',connectionState)
  console.log('signalling state before',signallingState)
  yourConn.close(); 
  yourConn.onicecandidate = null; 
  yourConn.onaddstream = null; 
  var connectionState1 = yourConn.connectionState;
  var signallingState1 = yourConn.signalingState;
  console.log('connection state after',connectionState1)
  console.log('signalling state after',signallingState1)
  document.getElementById('remoteSnapImg').hidden = true;
  document.getElementById('canvas').hidden = true;
  document.getElementById('callOngoing').style.display = 'none';
  document.getElementById('callReceiver').style.display = 'none';
  document.getElementById('callInitiator').style.display = 'block';
  //yourConn = null;
};

