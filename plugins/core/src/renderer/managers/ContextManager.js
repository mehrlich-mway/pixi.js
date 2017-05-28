import Renderer from '../Renderer';
import Manager from '../Manager';
import ContextAwareComponent from '../../components/ContextAwareComponent';
import createContext from '../../utils/createContext';

// @ifdef DEBUG
import debug from '../../debug';
// @endif

/**
 * @class
 * @mixes ContextAwareComponent
 */
export default class ContextManager extends Manager
{
    /**
     * @param {Renderer} renderer The renderer this Manager works for.
     */
    constructor(renderer)
    {
        super(renderer);

        /**
         * The WebGLRenderingContext instance.
         *
         * @readonly
         * @member {WebGLRenderingContext}
         */
        this.gl = null;

        // bind to some signals
        this._onPostRenderBinding = this.renderer.onPostRender.add(this._onPostRender, this);

        // initialize
        const options = renderer.options;

        if (options.context)
        {
            this._initFromContext(options.context);
        }
        else
        {
            // @ifdef DEBUG
            debug.ASSERT(options.canvas instanceof HTMLCanvasElement, 'Either the `context` or `canvas` options must be set.');
            // @endif

            this._initFromOptions({
                stencil: true,
                alpha: options.transparent,
                antialias: options.antialias,
                premultipliedAlpha: options.transparent && options.transparent !== 'notMultiplied',
                preserveDrawingBuffer: options.preserveDrawingBuffer,
            });
        }

        // @ifdef DEBUG
        debug.ASSERT(this.gl != null, 'Failed to create gl context.');
        // @endif

        // setup event listeners
        this._boundHandleContextLost = (e) => this._handleContextLost(e);
        this._boundHandleContextRestored = (e) => this._handleContextRestored(e);

        this.gl.canvas.addEventListener('webglcontextlost', this._boundHandleContextLost, false);
        this.gl.canvas.addEventListener('webglcontextrestored', this._boundHandleContextRestored, false);
    }

    /**
     * True when the context is missing or lost.
     *
     * @readonly
     * @member {boolean}
     */
    get isLost()
    {
        return (!this.gl || this.gl.isContextLost());
    }

    /**
     * Called when the manager is destroyed.
     *
     */
    destroy()
    {
        super.destroy();

        // remove listeners
        this.gl.canvas.removeEventListener('webglcontextlost', this._boundHandleContextLost);
        this.gl.canvas.removeEventListener('webglcontextrestored', this._boundHandleContextRestored);

        // clear program
        this.gl.useProgram(null);

        // lose context
        if (this.gl.getExtension('WEBGL_lose_context'))
        {
            this.gl.getExtension('WEBGL_lose_context').loseContext();
        }

        this.gl = null;

        this._onPostRenderBinding.detach();
        this._onPostRenderBinding = null;

        this._boundHandleContextLost = null;
        this._boundHandleContextRestored = null;
    }

    /**
     * Called when the renderer has completed rendering a frame.
     *
     */
    _onPostRender()
    {
        this.gl.flush();
    }

    /**
     * Used to validate that a context is useful for pixi.
     *
     * @private
     * @param {WebGLRenderingContext} gl The context to validate.
     */
    _validateContext(gl)
    {
        const attributes = gl.getContextAttributes();

        // this is going to be fairly simple for now.. but at least we have room to grow!
        if (!attributes.stencil)
        {
            /* eslint-disable no-console */
            console.warn('Provided WebGL context does not have a stencil buffer, masks may not render correctly');
            /* eslint-enable no-console */
        }
    }

    /**
     * Called by the ContextAwareComponent when the underlying context changes.
     *
     * @protected
     * @param {WebGLRenderingContext} gl The new context
     */
    _onContextChange(gl)
    {
        this.gl = gl;

        // restore a context if it was previously lost
        if (gl.isContextLost() && gl.getExtension('WEBGL_lose_context'))
        {
            gl.getExtension('WEBGL_lose_context').restoreContext();
        }
    }

    /**
     * Initializes the context manager based on an existing context.
     *
     * @private
     * @param {WebGLRenderingContext} gl The context
     */
    _initFromContext(gl)
    {
        this.gl = gl;
        this._validateContext(gl);
        this.renderer.onContextChange.dispatch(gl);
    }

    /**
     * Create a new context for the context manager based on the provided options.
     *
     * @private
     * @param {WebGLRenderingContext} options Options for new context creation.
     */
    _initFromOptions(options)
    {
        const gl = createContext(this.renderer.options.canvas, options);

        if (!gl)
        {
            throw new Error('This browser does not support WebGL.');
        }

        this._initFromContext(gl);
    }

    /**
     * Handles a lost webgl context
     *
     * @private
     * @param {WebGLContextEvent} event - The context lost event.
     */
    _handleContextLost(event)
    {
        event.preventDefault();
    }

    /**
     * Handles a restored webgl context
     *
     * @private
     */
    _handleContextRestored()
    {
        this.renderer.onContextChange.dispatch(this.gl);

        // TODO - tidy up textures?
        // this.textureSystem.removeAll();
    }
}

Renderer.addDefaultManager(ContextManager, 'context');
