'use strict';

var ClienteARI = require('ari-client');             //cliente

const generarAudio = require('./helpers/tts');
const convertirAudio = require('./helpers/sox');


//conexión a basa de datos: https://www.neoguias.com/como-conectarse-a-mysql-usando-node-js/

const { connection, consultadb } = require('./dataBase');

let id_usuario = '';
let cedula = '';
let tipo_apuesta='';

let query='';
let resultado='';
let text = '';
const pathAudios = `sound:/${__dirname}/audios/gsm/audio`;


ClienteARI.connect('http://localhost:8088', 'asterisk', 'asterisk', function (err, ari) {

  if (err) {
    throw err; // program will crash if it fails to connect
  }

  // Use once to start the application
  ari.on('StasisStart', function (event, incoming) {

    // Handle DTMF events
    //incoming.answer(setTimeout((err) => {
    //  play(incoming, 'sound:menuIntro')
    //}, 3000));
    console.log('---- Menu Inicio ---');
    console.log('Ingrese 1 para consultar una apuesta. Ingrese 2 para realizar una nueva apuesta.');
    incoming.on('ChannelDtmfReceived', introMenu);


    async function introMenu(event, channel) {

      const digit = event.digit;

      switch (digit) {
        case '1':    //Consultar resultados de apuestas
          incoming.removeListener('ChannelDtmfReceived', introMenu);
          //play(channel, 'sound:ConsultaApuestaCedula');
          console.log('- ConsultarApuesta -');
          console.log('Digite su cedula seguido de la tecla #');
          console.log('Si está inconforme con el número ingresado, digite *');
          cedula = '';
          incoming.on('ChannelDtmfReceived', consultarApuesta);
          break;

        case '2': //Realizar una nueva apuesta
          incoming.removeListener('ChannelDtmfReceived', introMenu);
          //play(channel, 'sound:nuevaApuesta');
          console.log('- RealizarApuesta -');
          console.log('Digite su cedula seguido de la tecla #');
          console.log('Si está inconforme con el número ingresado, digite *');
          cedula  = '';
          incoming.on('ChannelDtmfReceived', realizarApuesta); ///----------------FALTA
          break;

        default:
          console.log('default');
          text = 'opción no válida, inténtelo de nuevo';
          console.log(text);
          //await generarAudio(text);
          //await convertirAudio();
          //play(channel, pathAudios);
          incoming.removeListener('ChannelDtmfReceived', introMenu);
          incoming.on('ChannelDtmfReceived', introMenu); 
          break;
      }
    }
  });


  /**
   *  Initiate a playback on the given channel.
   *
   *  @function play
   *  @memberof example
   *  @param {module:resources~Channel} channel - the channel to send the
   *    playback to
   *  @param {string} sound - the string identifier of the sound to play
   *  @param {Function} callback - callback invoked once playback is finished
   */
  function play(channel, sound, callback) {
    var playback = ari.Playback();
    playback.once('PlaybackFinished',
      function (event, instance) {

        if (callback) {
          callback(null);
        }
      });
    channel.play({ media: sound }, playback, function (err, playback) { });
  }

  async function consultarApuesta(event, incoming) {
    console.log('---------consultar resultados de apuestas---------');
    let dato = event.digit;
    // Grabacion de peticion de cedula y marcacion de #
    switch (dato) {
      case '#':
        incoming.removeListener('ChannelDtmfReceived', consultarApuesta);
        console.log('## Seleccion de tipo de apuesta a consultar ##');
        console.log('1. última apuesta ganada y no pagada');
        console.log('2. Última apuesta pérdida');
        console.log('3. Última apuesta no jugada');
        incoming.on('ChannelDtmfReceived', consultaTipoA);
        break;

      case '*':
        cedula = '';
        incoming.removeListener('ChannelDtmfReceived', consultarApuesta);
        incoming.on('ChannelDtmfReceived', consultarApuesta);
        break

      default:
        cedula += dato;
        console.log('ingresando cedula');
        console.log(cedula);
        break;
    }
  }

  async function consultaTipoA(event, incoming) {
    let dato = event.digit;
    // Grabacion de peticion de tipo de apuestas a consultar
    switch (dato) {
      case '1':
        console.log('-- Consulta úlitma apuesta ganada y no pagada--');
        tipo_apuesta='2';
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        query = 'SELECT partidos.local, partidos.visitante, apuestas.goles_local, apuestas.goles_visitante, apuestas.monto FROM apuestas INNER JOIN usuarios ON apuestas.id_usuario=usuarios.id_usuario INNER JOIN partidos ON partidos.id_partido=apuestas.id_partido WHERE usuarios.cedula = '+cedula+' and apuestas.jugado='+tipo_apuesta+' and apuestas.pagado=0 ORDER BY apuestas.id_apuesta desc limit 1';
        console.log(query);
        resultado = await consultadb(query)
          .then(function (resultado) {
            if (!resultado) return
            console.log('se obtiene resultado');
            console.log(resultado);
            if(resultado!=null){
              text = 'Usted ha ganado la apuesta'+resultado.slice(1)+'vs'+resultado.slice(2)+'con el marcador'+resultado.slice(3)+'vs'+resultado.slice(4)+' y el monto de '+resultado.slice(5);      
            }else{
              text = 'Usted no cuenta con apuestas ganadas';
              console.log('Resultado vacío');
            }
          })
          .catch(text = 'La consulta realizada ha sido fallida, intente de nuevo')

        console.log(text);
        //await generarAudio(text);
        //await convertirAudio()
        query = '';
        console.log('Gracias por preferirnos, esperamos que disfrutes de este mundial. Hasta pronto.');
        //await play(incoming, pathAudios);
        setTimeout(function () {
          colgarLLamada(incoming);
        }, 2000)
        break;

      case '2':
        console.log('-- Consulta úlitma apuesta pérdida--');
        tipo_apuesta='1';
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        query = 'SELECT partidos.local, partidos.visitante, apuestas.goles_local, apuestas.goles_visitante, apuestas.monto FROM apuestas INNER JOIN usuarios ON apuestas.id_usuario=usuarios.id_usuario INNER JOIN partidos ON partidos.id_partido=apuestas.id_partido WHERE usuarios.cedula = '+cedula+' and apuestas.jugado='+tipo_apuesta+' ORDER BY apuestas.id_apuesta desc limit 1';
        console.log(query);
        resultado = await consultadb(query)
            .then(function (resultado) {
              console.log('se obtiene resultado');
              console.log(resultado);
              if(resultado!=null){
                text = 'Usted ha pérdido la apuesta'+resultado.slice(1)+'vs'+resultado.slice(2)+'con el marcador'+resultado.slice(3)+'vs'+resultado.slice(4)+' y el monto de '+resultado.slice(5);      
              }else{
                text = 'Usted no cuenta con apuestas pérdidas';
                console.log('Resultado vacío');
              }
            })
            .catch(text = 'La consulta realizada ha sido fallida, intente de nuevo.')

        console.log(text);
        //await generarAudio(text);
        //await convertirAudio()
        query = '';
        console.log('Gracias por preferirnos, esperamos que disfrutes de este mundial. Hasta pronto.');
        //await play(incoming, pathAudios);
        setTimeout(function () {
            colgarLLamada(incoming);
        }, 2000)
        break;

      case '3':
        console.log('-- Consulta úlitma apuesta no jugada--');
        tipo_apuesta='0';
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        query = 'SELECT partidos.local, partidos.visitante, apuestas.goles_local, apuestas.goles_visitante, apuestas.monto, partidos.fecha_partido FROM apuestas INNER JOIN usuarios ON apuestas.id_usuario=usuarios.id_usuario INNER JOIN partidos ON partidos.id_partido=apuestas.id_partido WHERE usuarios.cedula = '+cedula+' and apuestas.jugado='+tipo_apuesta+' ORDER BY apuestas.id_apuesta desc limit 1';
        console.log(query);
        resultado = await consultadb(query)
            .then(function (resultado) {
              console.log('se obtiene resultado');
              console.log(resultado);
              if(resultado!=null){
                text = 'Usted ha apostado al partido'+resultado.slice(1)+'vs'+resultado.slice(2)+'con el marcador'+resultado.slice(3)+'vs'+resultado.slice(4)+' y el monto de '+resultado.slice(5)+'. Este partido se jugará el '+resultado.slice(6);      
              }else{
                text = 'Usted no ha realizado ninguna apuesta o todas ya cuantan con un resultado';
                console.log('Resultado vacío');
              }
            })
            .catc
            .catch(text = 'La consulta realizada ha sido fallida, intente de nuevo')

        console.log(text);

        //await generarAudio(text);
        //await convertirAudio()
        console.log('Gracias por preferirnos, esperamos que disfrutes de este mundial. Hasta pronto.');
        query = '';
        //await play(incoming, pathAudios);
        setTimeout(function () {
            colgarLLamada(incoming);
        }, 2000)
        break;

      default:
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        console.log('default');
        text = 'Tipo de apuesta no válida, inténtelo de nuevo';
        console.log(text);
        //await generarAudio(text);
        //await convertirAudio();
        play(channel, pathAudios);
        incoming.on('ChannelDtmfReceived', consultarApuesta);
        break;
    }
  }

  async function realizarApuesta(event, incoming) {
    console.log('---------Realizar una nueva apuesta---------');
    let dato = event.digit;
    // Grabacion de peticion de cedula y marcacion de #
    switch (dato) {
      case '#':
        incoming.removeListener('ChannelDtmfReceived', realizarApuesta);
        text = 'Este acción se encuentra en reparación, intentelo más tarde.';
        console.log(text);
        //await generarAudio(text);
        //await convertirAudio();
        play(channel, pathAudios);

        break;

      default:
        incoming.removeListener('ChannelDtmfReceived', realizarApuesta);
        console.log('default');
        text = 'fallo en realizar apuesta, inténtelo de nuevo';
        console.log(text);
        //await generarAudio(text);
        //await convertirAudio();
        play(channel, pathAudios);
        incoming.on('ChannelDtmfReceived', realizarApuesta);
        break;
    }
  }

  function colgarLLamada(incoming) {
    setTimeout(function () {
      incoming.hangup();
    }, 2000);
  }

  ari.start('mundialFutbol');

});


//reconocimiento a: Santiago Andrés Zúñiga Sanchez, Lina Virginia Muñoz Garcés y Juan Diego Bravo Guevar
