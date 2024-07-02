import Player from "./player";
import Game from "./game";
import * as dgram from 'dgram';
import RemoveRoom from "../start_server";

class Room {
    players : Map<string, Player>;
    readied_players : Map<string, boolean>;
    id : string;
    locked : boolean;
    game : Game | null;
    name : string;
    game_mode : string;
    Listener : (msg : Buffer, rInfo : dgram.RemoteInfo) => void;
    server : dgram.Socket;

    constructor(player : Player, name :string, game_mode : string, server : dgram.Socket)
    {
        this.id = player.id;
        this.players = new Map<string, Player>();
        this.readied_players = new Map<string, boolean>();
        this.locked = false;
        this.game = null;
        this.name = name;
        this.game_mode = game_mode;
        this.server = server;
        this.Listener = (msg : Buffer, rInfo : dgram.RemoteInfo) => {
            this.RoomListener(msg, rInfo);
        };
        this.Add(player);
        this.server.on("message", this.Listener);
    }

    Add(player : Player) : boolean
    {
        if(this.locked) return false;
        this.players.set(player.id, player);
        //this.AddListener(player);
        return true;
    }

    RoomListener(data : Buffer, rInfo : dgram.RemoteInfo) : void {
        
        //parse data
        const receivedData = data.toString('utf-8');
        let json : any = JSON.parse(receivedData);
        if(!this.players.get(json.player_id)) return;

        switch(json._event.event_name)
        {
            case 'start': 
                this.StartGame();
                break;
            case 'ready':
                this.readied_players.set(json.player_id, !this.readied_players.get(json.player_id));
                console.log(this.readied_players.get(json.player_id));
                for(const [key, value] of this.readied_players)
                {
                    if(value == false){
                        let dt : any = {
                            event_name : "not all player ready"
                        }
                        let host_player : Player | undefined = this.players.get(this.id);
                        this.server.send(JSON.stringify(dt), 0, JSON.stringify(dt).length, host_player?.port, host_player?.address);
                        return;
                    }
                }

                let dt : any = {
                    event_name : "all player ready"
                }
                let host_player : Player | undefined = this.players.get(this.id);
                this.server.send(JSON.stringify(dt), 0, JSON.stringify(dt).length, host_player?.port, host_player?.address);
                break;
            case 'kick_player':
                let kickedplayer:Player | undefined =this.players.get(json._event.player_id);
                
                this.RemovePlayer(json._event.player_id);
                
                let data = {
                    event_name : 'kicked',
                }
                if(kickedplayer) 
                {
                    kickedplayer.in_room = false;
                    this.server.send(JSON.stringify(data), 0, JSON.stringify(data).length, kickedplayer.port, kickedplayer.address);
                }

                let data1={
                    event_name : 'kick',
                    player_id : json._event.player_id,
                    host_id: json._event.host_id
                }
                for(const [key, player] of this.players){
                    
                    this.server.send(JSON.stringify(data1), 0, JSON.stringify(data1).length, player.port, player.address);
                }
                console.log(data1);
                break;
            case 'leave':
                let pl : Player | undefined =this.players.get(json._event.player_id);
                if(pl) pl.in_room = false;
                this.PlayerOutRoom(json.player_id);
                break;
        }
    }

    RemovePlayer(id : string)
    {
        this.players.delete(id);
    }

    PlayerOutRoom(player_id : string)
    {
        if(player_id == this.id) {
            this.DeleteRoom();
        }
        else {
            this.RemovePlayer(player_id);
            let data : any = {
                event_name : "player leave",
                player_id : player_id,
                host_id : this.id
            }
            for(const [key, player] of this.players) 
            {
                this.server.send(JSON.stringify(data), 0, JSON.stringify(data).length, player.port, player.address);
            }
        }
        //send sth back to confirm
    }

    DeleteRoom()
    {
        //for(let i = 0; i < this.players.length; i++) this.players[i].socket.removeListener('data', this.Listener);
        let data : any = {
            event_name : 'disband',
        }
        for(const [key, player] of this.players) 
        {
            player.in_room = false;
            if(player.id != this.id) this.server.send(JSON.stringify(data), 0, JSON.stringify(data).length, player.port, player.address);
        }
        this.players.clear();
        this.server.removeListener('message', this.Listener);
        RemoveRoom(this.id);
    }

    StartGame()
    {
        //init game state
        this.game = new Game(this.players, this);
        let d1 : any = {
            event_name : "start"
        }
        for(const [key, value] of this.players)
        {
            this.server.send(JSON.stringify(d1), 0, JSON.stringify(d1).length, value.port, value.address);
        }
        this.locked = true;

        //emit game started to all players
    }

    Done() : void
    {
        this.game = null;
        this.locked = false;
    }
}

export default Room;