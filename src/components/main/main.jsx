
import React from 'react'
import Pixi from 'pixi.js'
import Tick from '@mattstyles/tick'
import Bezier from 'bezier-easing'
import Quay from 'quay'
import P2 from 'p2'
import random from 'lodash.random'
import debounce from 'debounce'

import canvas from './canvas'
import renderer from './renderer'
import Stats from './stats'

import Engine from 'world/engine'
import Stars from 'world/stars'
import Entity from 'entities/entity'
import PhysicalEntity from 'entities/physical'
import Bullet from 'entities/bullet'
import User from 'user/user'
import Debug from 'debug/debug'

import materials from 'world/materials'
import resources from 'stores/resources'
import config from 'stores/config'


/**
 * @class
 * Main class holds the main game canvas renderer
 */
export default class Main extends React.Component {
    static propTypes = {
        canvas: React.PropTypes.string
    }

    static defaultProps = {
        canvas: 'js-main'
    }

    constructor( props ) {
        super( props )

        this.renderer = null
        this.renderTick = null
    }

    componentWillMount() {
        this.stats = new Stats([ 0, 2 ])
    }

    componentDidMount() {
        // Set up the canvas & renderer
        let id = this.props.canvas
        canvas.create( id, this.refs.main )
        renderer.create( id, canvas.get( id ) )
        this.renderer = renderer.get( id )

        try {
            // Set up a user
            this.user = new User()
            this.user.setPosition( 0, 80 )

            // Set up input
            this.quay = new Quay()
            this.addHandlers()


            // Master stage, renderer renders this
            this.stage = new Pixi.Container()

            // Use Engine class
            this.engine = new Engine()
            this.engine.addEntity( this.user )

            // Generate background
            this.stars = new Stars()


            // Add actors to the stage
            this.stage.addChild( this.stars.container )
            this.stage.addChild( this.engine.container )

            // Create a few extra entities, just for funsies
            this.entities = []
            let numEntities = random( 10, 20 )
            let bound = numEntities * 100
            for ( let i = 0; i < numEntities; i++ ) {
                let entity = new PhysicalEntity({
                    position: [ ~random( -bound, bound ), ~random( -bound, bound ) ]
                })
                entity.addShape( new P2.Circle({
                    radius: random( 5, 20 ),
                    materal: materials.get( '_default' )
                }))
                entity._debug = true
                this.engine.addEntity( entity )
            }

            //Create a complex entity
            let entity = new PhysicalEntity({
                position: [ 0, 0 ],
                angle: 0
            })

            entity.addShape( new P2.Circle({
                radius: 40,
                material: materials.get( '_default' )
            }))
            entity.addShape( new P2.Circle({
                radius: 20,
                material: materials.get( '_default' )
            }), [ 32, -32 ], Math.PI )
            entity.addShape( new P2.Circle({
                radius: 20,
                material: materials.get( '_default' )
            }), [ -32, -32 ], Math.PI )

            entity._debug = true
            this.engine.addEntity( entity )

            // @TODO debug user render
            window.stage = this.stage
            window.engine = this.engine
            window.user = this.user
            window.starfield = this.starfield
            window.entities = this.entities
            window.config = config
            window.materials = materials
            // window.ent = entity

        } catch ( err ) {
            console.warn( err, err.stack )
        }


        // Set up the render tick
        this.renderTick = new Tick()
            // .on( 'data', this.onUpdate )
            .on( 'data', this.onRender )
            .once( 'data', this.onInitialRender )


        window.pause = () => {
            this.renderTick.pause()
        }
        window.resume = () => {
            this.renderTick.resume()
        }
    }

    addHandlers() {
        if ( !this.quay ) {
            logger.warn( 'Quay not instantiated' )
            return
        }
        this.quay.on( '<up>', this.user.forward )
        this.quay.on( '<down>', this.user.backward )
        this.quay.on( '<left>', this.user.left )
        this.quay.on( '<right>', this.user.right )
        this.quay.on( 'Q', this.user.bankLeft )
        this.quay.on( 'E', this.user.bankRight )

        this.quay.stream( '<shift>' )
            .on( 'keydown', () => {
                this.user.thrust = 190
            })
            .on( 'keyup', () => {
                this.user.thrust = 150
            })

        var lastFire = 0
        var reloadTime = .75

        this.quay.stream( '<space>' )
            .on( 'data', () => {
                if ( this.engine.world.time - lastFire < reloadTime ) {
                    return
                }

                console.log( 'firing' )

                lastFire = this.engine.world.time

                // User radius plus bullet radius plus a little extra
                // @TODO User radius probably wont exist for much longer
                let radius = ( this.user.radius + 3 ) * 1.5
                let angle = this.user.angle + Math.PI * .5
                let mag = 50
                let turretPos = [
                    radius * Math.cos( angle ) + this.user.position[ 0 ],
                    radius * Math.sin( angle ) + this.user.position[ 1 ]
                ]
                let bulletVel = [
                    mag * Math.cos( angle ) + this.user.body.velocity[ 0 ],
                    mag * Math.sin( angle ) + this.user.body.velocity[ 1 ]
                ]
                // @TODO create bullet with a different material then set up the
                // material scalar for calculating PhysicalEntity mass
                let bullet = new Bullet({
                    position: turretPos,
                    velocity: bulletVel,
                    angle: this.user.angle
                })

                bullet.addShape( new P2.Circle({
                    radius: 2
                }))

                // bullet.setPosition( ...turretPos )

                // Applying a force doesnt really cut, just manually calc velocity
                // based on craft velocity and magnitude
                // bullet.applyForceLocal([ 0, .5 ])

                // bullet.update()
                // bullet._drawDebug()
                bullet._debug = true
                bullet.render()

                this.engine.addEntity( bullet )
            })
    }

    onUpdate = dt => {
        // Update the physics world
        this.engine.update( dt )

        // Dampen star movement
        // Entities should move fast compared to each other, not compared to the backdrop
        // There might also need to be a planet layer that sits somewhere in between speeds
        //this.starfield.setPosition( this.user.body.position[ 0 ] / 10, this.user.body.position[ 1 ] / 10 )
        this.stars.setPosition( ...this.user.position )

        // This translation effectively simulates the camera moving, although simple
        // it should still be extracted into a camera class
        this.engine.container.position.set(
            ( config.get( 'width' ) / 2 ) - this.user.position[ 0 ],
            ( config.get( 'height' ) / 2 ) - this.user.position[ 1 ]
        )

        this.stars.update()
    }

    onInitialRender = () => {
        //this.user.render()
        this.engine.update( 1 / 60 )
        //this.user.render()

        this.engine.entities.forEach( entity => entity.render() )
    }

    onRender = dt => {
        this.stats.begin()

        this.onUpdate( dt )
        this.renderer.render( this.stage )

        this.stats.end()
    }

    render() {
        // console.log( 'main render' )

        // @TODO does the canvas want to be buried this deep in the DOM?
        // No problems with creating them from document.body and just reffing them
        return (
            <div ref="main" className="js-main u-fit">
                <Debug data={ this.props.state.cursor( 'debug' ) } />
            </div>
        )
    }
}
