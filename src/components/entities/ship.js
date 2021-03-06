
import P2 from 'p2'
import Pixi from 'pixi.js'

import compose from 'utils/compose'
import materials from 'world/materials'
import SC_TYPES from 'constants/shipComponentTypes'
import shipComponents from 'stores/shipComponents'

import PhysicalEntity from 'entities/physical'
import ThrustModule from 'entities/modules/thrust'
import AttackModule from 'entities/modules/attack'
import DebugModule from 'entities/modules/debug'

/**
 * Main ship entity
 * @see modules/README.md for the use of the mixin function
 * @class
 */
export default class Ship extends compose(
    PhysicalEntity.compose,
    AttackModule,
    ThrustModule,
    DebugModule ) {
    /**
     * @constructs
     * @return this
     */
    constructor( opts = {} ) {
        super( opts )

        this.id = opts.id || '_defaultShip'

        /**
         * Hardpoints refer to external positions that components can be mounted
         * on to.
         * @TODO hardpoints should have a function associated with them, i.e.
         * only thrusters can go on thrust-mounts etc etc
         */
        this.hardpoints = new Map()

        // Set application forces
        // @TODO should be calculated from components
        // Thrust components should determine offset and magnitude of thrusts
        // applied per action i.e. main forward thrust should be a composite of
        // all the thrusters connected with the 'main:thrust' behaviour
        this.turnThrust = .25
        this.bankThrust = 50

        // Linear thrust is now recalculated from thrust components
        // @TODO Currently all thrust components contribute, this needs further
        // refinement
        this.linearThrust = [
            {
                offset: [ 0, 0 ],
                magnitude: [ 0, 150 ]
            }
        ]

        // Set up damping
        // @TODO again, this should be calculated as damping components are added
        // or removed from the entity
        this.body.damping = .05
        this.body.angularDamping = .01

        return this
    }

    addHardpoint( hardpoint ) {
        if ( this.hardpoints.has( hardpoint.id ) ) {
            throw new Error( 'A hardpoint with the id ' + hardpoint.id + ' is already added to ship ' + this.id )
        }

        this.hardpoints.set( hardpoint.id, hardpoint )
    }

    /**
     * Adds a component to a ship hardpoint
     */
    mountHardpoint( hardpointID, component ) {
        if ( !component ) {
            throw new Error( 'Adding a component requires a component and hardpoint be specified' )
        }
        if ( !hardpointID ) {
            throw new Error( 'Component must be mounted to a hardpoint' )
        }
        if ( !this.hardpoints.has( hardpointID ) ) {
            throw new Error( 'Hardpoint not recognised on this entity' )
        }

        let hardpoint = this.hardpoints.get( hardpointID )

        hardpoint.mountComponent( component )

        component.parent = this

        if ( component.shape ) {
            this.addShape( component.shape, hardpoint.offset || [ 0, 0 ], component.angle || 0 )
        }

        // @TODO not sure I like this, a component onMount would be better, which
        // gets passed the entity. This gives the component a lot of control but
        // makes more sense that handling the logic here.
        if ( component.type === SC_TYPES.get( 'THRUSTER' ) ) {
            this.calcLinearThrust()
        }

        return this
    }

    /**
     * Removes a component from a hardpoint
     */
    unmountHardpoint( hardpointID ) {
        let component = this.hardpoints
            .get( hardpointID )
            .unmountComponent()

        if ( component.shape ) {
            this.removeShape( component.shape )
        }

        return this
    }

    /**
     * Loops through hardpoints, grabs mounted thruster components and appends
     * their data to the linearThrust array.
     * This is done every time a component is added, which is better than doing
     * it every time we need to use the linear thrust to calculate momentum.
     * @returns this
     */
    calcLinearThrust() {
        // Filter component map to thruster types and generate a new array of
        // linear thrust components
        this.linearThrust = []

        // @TODO proper filter functions for maps
        this.hardpoints.forEach( ( hardpoint, id ) => {
            let component = hardpoint.mounted

            // A null value for a hardpoint is valid, so just bail
            if ( !component ) {
                return
            }

            // Filter for thruster types
            if ( component.type !== SC_TYPES.get( 'THRUSTER' ) ) {
                return
            }

            this.linearThrust.push({
                offset: component.offset,
                magnitude: component.magnitude
            })
        })
    }
}
