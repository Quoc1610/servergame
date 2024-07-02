import Room from "./src/room";
import Player from "./src/player";
import Creep from "./src/creep";
import * as dgram from "dgram";
import {v4} from 'uuid';
import { SendRoomsInfoToClient, GetPlayersInfo } from "./src/function";

var onlinePlayers : Map<string, Player> = new Map<string, Player>();
var Rooms : Map<string, Room> = new Map<string, Room>();


const server = dgram.createSocket('udp4');

//Handle request from clients
server.on('message', (data: Buffer, rInfo : dgram.RemoteInfo) => {
        //parse data
        const receivedData = data.toString('utf-8');
        console.log(receivedData);
        let json : any = JSON.parse(receivedData);
         
 
        //process event
        switch(json._event.event_name)
        {
            case 'first connect':
                //player first connect => provide a specific id and add to online players
                let playerID : string = v4();
                let thisPlayer : Player = new Player(playerID, rInfo.address, rInfo.port, 1,json._event.name);
                onlinePlayers.set(playerID, thisPlayer);
                let d = {
                    event_name : "provide id",
                    id : playerID,
                    player_name : thisPlayer.name,
                    gun_id : thisPlayer.gun_id
                }
                
                server.send(JSON.stringify(d), 0, JSON.stringify(d).length, rInfo.port, rInfo.address);

                //Just test 
                // Creep.getInstance().OnRoomCreateMock();
                // Creep.getInstance().StartSpawnProcessMock(0, server, rInfo.port, rInfo.address);

                break;
            //create room
            case 'create_rooms':
                let player : Player | undefined = onlinePlayers.get(json.player_id);
                if(player) {
                    Rooms.set(player.id, new Room(player, json._event.name, json._event.game_mode, server));
                    Rooms.get(player.id)?.readied_players.set(player.id, true);
                    player.in_room = true;
                }
                break;
            //get available room
            case 'get_rooms':
                SendRoomsInfoToClient(server, Rooms, rInfo.address, rInfo.port);
                break;
            //join room
            case 'join_room':
                //Get info
                let room : Room | undefined  = Rooms.get(json._event.room_id);
                let players : Map<string, Player>  = room ? room.players : new Map<string, Player>();
                let join_player : Player | undefined = onlinePlayers.get(json.player_id);
                if(join_player) {
                    room?.Add(join_player);
                    room?.readied_players.set(join_player.id, false);
                    join_player.in_room = true;
                }

                //send host info to join player
                let data = {
                    event_name : "joined",
                    players : players ? GetPlayersInfo(players) : null
                }
                server.send(JSON.stringify(data), 0, JSON.stringify(data).length, rInfo.port, rInfo.address);
                
                //send join player info to other players in room
                let data1 = {
                    event_name : "new player join",
                    player_id : join_player?.id,
                    player_name : join_player?.name
                }
                for(const [key, player] of players){
                    if(key != json.player_id) server.send(JSON.stringify(data1), 0, JSON.stringify(data1).length, player.port, player.address);
                }
                
                console.log(GetPlayersInfo(players));
                
                break;
            case "start":
                let pl : Player | undefined = onlinePlayers.get(json.player_id);
                if(pl && !pl.in_room) {
                    Rooms.set(pl.id, new Room(pl, json._event.name, json._event.game_mode, server));
                    pl.in_room = true;
                    Rooms.get(pl.id)?.readied_players.set(pl.id, true);
                    Rooms.get(pl.id)?.StartGame();
                }
                break;
            case "choose gun":
                let _pl : Player | undefined = onlinePlayers.get(json.player_id);
                if(_pl) _pl.gun_id = json._event.gun_id;
                break;
           
        };
    });

//start server
const PORT = 9999;
server.on('listening', () => {
    server.setSendBufferSize(64 * 1024);
    const address = server.address();
    console.log(`Server listening on ${address.address}:${address.port} with send buffer size: ${server.getSendBufferSize()} Bytes`);
});

server.bind(PORT, '0.0.0.0');
// server.setSendBufferSize(64 * 1024);

setInterval(() => {
    //test spawning creep
    //server.send(JSON.stringify(data1), 0, JSON.stringify(data1).length, player.port, player.address);
}, 1000);

//support functions
var RemoveRoom = (room_id : string) => {
    Rooms.delete(room_id);
}

export default RemoveRoom;