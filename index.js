'use strict';

var ClienteARI = require('ari-client');             //cliente

const generarAudio = require('./helpers/tts');
const convertirAudio = require('./helpers/sox');


//conexión a basa de datos: https://www.neoguias.com/como-conectarse-a-mysql-usando-node-js/

const { connection, consultadb } = require('./dataBase');

let id_usuario = '';
let cedula = '';
let tipo_apuesta='';

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
          consultaA(event, incoming, channel);
          break;

        case '2': //Realizar una nueva apuesta
          incoming.removeListener('ChannelDtmfReceived', introMenu);
          //play(channel, 'sound:nuevaApuesta');
          console.log('- RealizarApuesta -');
          console.log('Digite su cedula seguido de la tecla #');
          nuevaA(event, incoming);
          break;

        default:
          console.log('default');
          text = 'opción no válida, inténtelo de nuevo';
          console.log(text);
          //await generarAudio(text);
          //await convertirAudio();
          play(channel, pathAudios);
          break;
      }
    }

    function  consultaA(event, incoming, channel) {
      cedula = '';
      console.log('---------consultar resultados de apuestas---------');
      incoming.on('ChannelDtmfReceived', consultarApuesta);
    }

    function nuevaA(event, incoming) {
      cedula  = '';
      console.log('---------Realizar una nueva apuesta---------');
      incoming.on('ChannelDtmfReceived', realizarApuesta); ///----------------FALTA
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
    let dato = event.digit;
    // Grabacion de peticion de cedula y marcacion de #
    switch (dato) {
      case '#':
        incoming.removeListener('ChannelDtmfReceived', consultarApuesta);
        console.log('## Seleccion de tipo de apuesta a consultar ##');
        console.log('1. Apuesta ganada');
        console.log('2. Apuesta pérdida');
        console.log('3. Apuesta no jugada');
        incoming.on('ChannelDtmfReceived', consultaTipoA);
        break;

      case '*':
        cedula = '';
        incoming.removeListener('ChannelDtmfReceived', consultarApuesta);
        incoming.on('ChannelDtmfReceived', consultarApuesta);
        break

      default:
        cedula += dato;
        console.log('guardando cedula');
        console.log(cedula);
        break;
    }
  }

  async function consultaTipoA(event, incoming) {
    let dato = event.digit;
    // Grabacion de peticion de tipo de apuestas a consultar
    switch (dato) {
      case '1':
        console.log('Ingresa a opción 1');
        tipo_apuesta='2';
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        query = `SELECT count(*) FROM apuestas INNER JOIN usuarios ON apuestas.id_usuario=usuarios.id_usuario WHERE usuarios.cedula = ${cedula} and apuestas.jugado='${tipo_apuesta}' and apuestas.pagado='0' ORDER BY apuestas.id_apuesta desc`;

        resultado = await consultadb(query)
          .then(function (resultado) {
            if (!resultado) return
            text = `usted cuenta con ${resultado} apuestas ganadas y no cobradas`;
          })
          .catch(text = 'La consulta realizada ha sido fallida, intente de nuevo')

        console.log(text);
        //await generarAudio(text);
        //await convertirAudio()
        query = '';
        //await play(incoming, pathAudios);
        setTimeout(function () {
          colgarLLamada(incoming);
        }, 5000)
        break;

      case '2':
        console.log('Ingresa a opción 2');
        tipo_apuesta='1';
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        query = `SELECT count(*) FROM apuestas INNER JOIN usuarios ON apuestas.id_usuario=usuarios.id_usuario WHERE usuarios.cedula = ${cedula} and apuestas.jugado='${tipo_apuesta}' ORDER BY apuestas.id_apuesta desc`;

        resultado = await consultadb(query)
            .then(function (resultado) {
            if (!resultado) return
            text = `usted cuenta con ${resultado} apuestas pérdidas`;
            })
            .catch(text = 'La consulta realizada ha sido fallida, intente de nuevo.')

        console.log(text);
        //await generarAudio(text);
        //await convertirAudio()
        query = '';
        //await play(incoming, pathAudios);
        setTimeout(function () {
            colgarLLamada(incoming);
        }, 5000)
        break;

      case '3':
        console.log('Ingresa a opción 3');
        tipo_apuesta='0';
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        query = `SELECT count(*) FROM apuestas INNER JOIN usuarios ON apuestas.id_usuario=usuarios.id_usuario WHERE usuarios.cedula = ${cedula} and apuestas.jugado='${tipo_apuesta}' ORDER BY apuestas.id_apuesta desc`;

        resultado = await consultadb(query)
            .then(function (resultado) {
            if (!resultado) return
            text = `usted cuenta con ${resultado} apuestas aún no jugadas. Espere a que el partido se lleve a cabo.`;
            })
            .catch(text = 'La consulta realizada ha sido fallida, intente de nuevo')

        console.log(text);

        //await generarAudio(text);
        //await convertirAudio()
        query = '';
        //await play(incoming, pathAudios);
        setTimeout(function () {
            colgarLLamada(incoming);
        }, 5000)
        break;

      default:
        incoming.removeListener('ChannelDtmfReceived', consultaTipoA);
        console.log('default');
        text = 'Tipo de apuesta no válida, inténtelo de nuevo';
        console.log(text);
        //await generarAudio(text);
        //await convertirAudio();
        play(channel, pathAudios);
        incoming.on('ChannelDtmfReceived', consultaTipoA);
        break;
    }
  }

  async function realizarApuesta(event, incoming) {

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


//reconocimiento a: Santiago Andrés Zúñiga Sanchez, Lina Virginia Muñoz Garcés y Juan Diego Bravo Guevara
