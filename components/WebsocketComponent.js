import {DailyProvider, useDaily} from '@daily-co/daily-react';
import React, {useEffect, useRef, useState} from 'react';

const DailyAudioCall = ({ websocketUrl, agent_id }) => {
    const callObject = useDaily();
    const [isCallConnected, setIsCallConnected] = useState(false);
    const socket = useRef(null);
    const mediaRecorder = useRef(null);
    const audioTrackRef = useRef(null);

    useEffect(() => {
        let currentAudio = null; // Reference to the current Audio object

        // function to stop audio in between
        function stopAudio() {
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.srcObject = null;
                    currentAudio = null;
                }
                setIsCallConnected(false);
            }

        if (!websocketUrl || !callObject) return;

        if (!socket.current) {
            socket.current = new WebSocket(websocketUrl);

            socket.current.onopen = () => {
                console.log("WebSocket connection opened");
            };

            socket.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            socket.current.onclose = () => {
                console.log("WebSocket connection closed");
                callObject.destroy()
            };

            const joinCall = async (roomUrl) => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioTrackRef.current = stream.getAudioTracks()[0];
                    await callObject.join({ url: roomUrl, audioSource: audioTrackRef.current, videoSource: false, userName: agent_id});
                    await callObject.startRecording()
                    setIsCallConnected(true);
                    mediaRecorder.current = new MediaRecorder(stream);
                    mediaRecorder.current.ondataavailable = async (event) => {
                        if (event.data.size > 0 && socket.current.readyState === WebSocket.OPEN) {
                            const reader = new FileReader();
                            reader.readAsDataURL(event.data);
                            reader.onloadend = () => {
                                const base64AudioMessage = reader.result.split(',')[1];
                                socket.current.send(JSON.stringify({ type: 'audio', data: base64AudioMessage }));
                            };
                        }
                    };
                    mediaRecorder.current.start(200);
                } catch (error) {
                    console.error('Error capturing audio:', error);
                }
            };

            socket.current.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                console.log(message)
                if (message.connection && (message.type !== "clear")) {
                    if (message.type === "setup"){
                        console.log(message['room_url'])
                        await joinCall(message['room_url'])
                        console.log("Connection is established")
                    } else {
                        console.log("Connection is running")
                    }
                } else if (message.connection && message.type === "clear") {
                    console.log("clearing audio")
                   stopAudio()
                } else {
                    console.log("destroying call line 92")
                    await callObject.stopRecording()
                    await callObject.destroy();
                    socket.current.close();
                }
            };

            callObject.on('joined-meeting', () => {
                setIsCallConnected(true);
            });

            callObject.on('left-meeting', () => {
                setIsCallConnected(false);
            });

            callObject.on('participant-updated',  (event) => {
                const participant = event.participant;
                console.log(participant)
                if (participant.tracks.audio.persistentTrack && participant.user_name === 'bolna-ai') {
                    console.log("something changed in audio & AI changed it in participant audio & hence playing the audio")
                    const stream = new MediaStream([participant.tracks.audio.track]);
                    currentAudio = new Audio();
                    currentAudio.srcObject = stream;
                    currentAudio.play();
                }
            });

            callObject.on('track-started',  (event) => {
                const participant = event.participant;
                console.log(participant)
                if (participant.tracks.audio.track && participant.user_name !== agent_id) {
                    console.log("something changed in track & AI changed it in audio & hence playing the audio")
                    const stream = new MediaStream([participant.tracks.audio.track]);
                    currentAudio = new Audio();
                    currentAudio.srcObject = stream;
                    currentAudio.play();
                }
            });

            return () => {

                if (callObject) {
                    callObject.stopRecording()
                    callObject.destroy();
                }

                if (socket.current) {
                    socket.current.close();
                }
            };
        }
    }, [websocketUrl, agent_id, callObject]);

    return (
        <div>
            <h2>Bolna AI websocket Audio Call</h2>
            {isCallConnected ? (
                <p>Call is connected. You can now speak with our AI or wait for the AI response.</p>
            ) : (
                <p>bolna-AI: Let me speak now...</p>
            )}
        </div>
    );
};

const App = ({ agentId, accessToken }) => {
    const websocketUrl = `${process.env.REACT_APP_WEBSOCKET_ENDPOINT}/${agentId}?auth_token=${accessToken}&user_agent=dashboard&enforce_streaming=true`;

    return (
        <DailyProvider>
            <DailyAudioCall websocketUrl={websocketUrl} agent_id={agentId} />
        </DailyProvider>
    );
};

export default App;