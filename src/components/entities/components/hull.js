
import P2 from 'p2'

import logger from 'utils/logger'
import materials from 'world/materials'
import SC_TYPES from 'constants/shipComponentTypes'

export default class Hull {
    constructor( opts ) {
        this.id = opts.id || '_default ID'
        this.type = SC_TYPES.get( 'HULL' )
        this.material = opts.material || materials.get( 'metal' )
        this.radius = opts.radius || 10

        this.shape = new P2.Circle({
            radius: this.radius,
            material: this.material
        })
    }
}
