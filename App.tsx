/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useCallback, ChangeEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateProductScene } from './services/geminiService';
import Footer from './components/Footer';

const primaryButtonClasses = "font-permanent-marker text-2xl text-center text-black bg-yellow-400 py-4 px-12 rounded-sm transform transition-all duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:rotate-0";
const secondaryButtonClasses = "font-permanent-marker text-lg text-center text-white bg-white/10 backdrop-blur-sm border-2 border-white/80 py-2 px-6 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";

const PROMPT_OPTIONS = {
  lifestyle: 'Create a photorealistic lifestyle image of the person happily using the product in a bright, modern living room.',
  fashion: 'Generate a high-fashion studio shot of the person modeling the product against a clean, minimalist background.',
};

// --- Reusable Image Dropzone Component ---
interface ImageDropzoneProps {
    title: string;
    image: string | null;
    onImageUpload: (file: File) => void;
    onClearImage: () => void;
}

const ImageDropzone = ({ title, image, onImageUpload, onClearImage }: ImageDropzoneProps) => {
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageUpload(e.target.files[0]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onImageUpload(e.dataTransfer.files[0]);
        }
    }, [onImageUpload]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const inputId = `file-upload-${title.toLowerCase().replace(' ', '-')}`;

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            <h2 className="font-permanent-marker text-2xl text-neutral-300">{title}</h2>
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="w-full h-64 rounded-lg border-2 border-dashed border-neutral-600 flex items-center justify-center relative bg-white/5 group transition-colors hover:border-yellow-400 hover:bg-white/10"
            >
                {image ? (
                    <>
                        <img src={image} alt={`${title} preview`} className="w-full h-full object-contain p-2 rounded-lg" />
                        <button
                            onClick={onClearImage}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label={`Remove ${title} image`}
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </>
                ) : (
                    <label htmlFor={inputId} className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-neutral-400 group-hover:text-yellow-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="font-permanent-marker">Click or drop image</span>
                    </label>
                )}
                <input id={inputId} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
            </div>
        </div>
    );
};


// --- Reusable Prompt Option Component ---
interface PromptOptionProps {
    label: string;
    description: string;
    isSelected: boolean;
    onClick: () => void;
}
const PromptOption = ({ label, description, isSelected, onClick }: PromptOptionProps) => (
    <div
        onClick={onClick}
        role="radio"
        aria-checked={isSelected}
        tabIndex={0}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onClick()}
        className={`w-full p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
            isSelected
                ? 'border-yellow-400 bg-white/10 shadow-lg'
                : 'border-neutral-600 bg-white/5 hover:border-neutral-500'
        }`}
    >
        <div className="flex items-center gap-4">
            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-yellow-400' : 'border-neutral-500'}`}>
                {isSelected && <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />}
            </div>
            <div>
                <h3 className="font-permanent-marker text-base text-neutral-100">{label}</h3>
                <p className={`text-xs mt-1 transition-colors ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>{description}</p>
            </div>
        </div>
    </div>
);


function App() {
    const [personImage, setPersonImage] = useState<string | null>(null);
    const [productImage, setProductImage] = useState<string | null>(null);
    const [promptOption, setPromptOption] = useState<'lifestyle' | 'fashion' | 'custom'>('lifestyle');
    const [prompt, setPrompt] = useState<string>(PROMPT_OPTIONS.lifestyle);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [appState, setAppState] = useState<'idle' | 'generating' | 'results' | 'error'>('idle');
    const generationCancelledRef = useRef(false);

    const handleImageUpload = (file: File, type: 'person' | 'product') => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (type === 'person') setPersonImage(reader.result as string);
          if (type === 'product') setProductImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };
    
    const handlePromptOptionChange = (option: 'lifestyle' | 'fashion' | 'custom') => {
        setPromptOption(option);
        if (option === 'lifestyle') {
            setPrompt(PROMPT_OPTIONS.lifestyle);
        } else if (option === 'fashion') {
            setPrompt(PROMPT_OPTIONS.fashion);
        }
        // If 'custom', we keep the current prompt text for editing
    };

    const handleGenerate = async () => {
        if (!personImage || !productImage) return;

        setIsLoading(true);
        setGeneratedImage(null);
        setError(null);
        setAppState('generating');
        generationCancelledRef.current = false;
        
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (generationCancelledRef.current) return;

            try {
                if (attempt > 1) {
                    setError(`That didn't work, trying again... (Attempt ${attempt}/${MAX_ATTEMPTS})`);
                }
                
                const resultUrl = await generateProductScene(personImage, productImage, prompt);

                if (generationCancelledRef.current) return;

                setGeneratedImage(resultUrl);
                setError(null);
                setIsLoading(false);
                setAppState('results');
                return; // Success, exit the loop.
            } catch (err) {
                if (generationCancelledRef.current) return;

                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                console.error(`Generation attempt ${attempt} failed:`, errorMessage);

                if (attempt === MAX_ATTEMPTS) {
                    setError("Sorry, the AI couldn't create an image. Please try different images or a new prompt.");
                    setIsLoading(false);
                    setAppState('error');
                    return;
                }
                
                // Wait for a bit before the next retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    };

    const handleCancel = () => {
        generationCancelledRef.current = true; // Signal to stop any ongoing generation loop
        setIsLoading(false);
        setAppState('idle');
        setError(null);
        setGeneratedImage(null);
    };

    const handleReset = () => {
        generationCancelledRef.current = true; // Signal to stop any ongoing generation loop
        setPersonImage(null);
        setProductImage(null);
        setGeneratedImage(null);
        setError(null);
        setIsLoading(false);
        setAppState('idle');
        setPromptOption('lifestyle');
        setPrompt(PROMPT_OPTIONS.lifestyle);
    };

    return (
        <main className="bg-black text-neutral-200 min-h-screen w-full flex flex-col items-center p-4 pb-24 overflow-y-auto relative">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]" aria-hidden="true"></div>
            
            <div className="z-10 flex flex-col items-center w-full max-w-6xl mx-auto flex-1">
                <div className="text-center my-10">
                    <h1 className="text-6xl md:text-8xl font-caveat font-bold text-neutral-100">Ubah Bajumu</h1>
                    <p className="font-permanent-marker text-neutral-300 mt-2 text-xl tracking-wide">tanpa ribet tanpa beli dulu</p>
                </div>
                
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
                    <ImageDropzone title="Product" image={productImage} onImageUpload={(file) => handleImageUpload(file, 'product')} onClearImage={() => setProductImage(null)} />
                    <ImageDropzone title="Person" image={personImage} onImageUpload={(file) => handleImageUpload(file, 'person')} onClearImage={() => setPersonImage(null)} />
                     <div className="flex flex-col items-start gap-4 w-full md:col-span-2 lg:col-span-1">
                        <h2 className="font-permanent-marker text-2xl text-neutral-300 self-center">Instructions</h2>
                        <div className="w-full space-y-2" role="radiogroup" aria-labelledby="instructions-heading">
                            <PromptOption
                                label="Lifestyle Scene"
                                description={PROMPT_OPTIONS.lifestyle}
                                isSelected={promptOption === 'lifestyle'}
                                onClick={() => handlePromptOptionChange('lifestyle')}
                            />
                            <PromptOption
                                label="Fashion Shoot"
                                description={PROMPT_OPTIONS.fashion}
                                isSelected={promptOption === 'fashion'}
                                onClick={() => handlePromptOptionChange('fashion')}
                            />
                            <PromptOption
                                label="Custom Prompt"
                                description="Write your own detailed instructions."
                                isSelected={promptOption === 'custom'}
                                onClick={() => handlePromptOptionChange('custom')}
                            />
                        </div>

                        <AnimatePresence>
                            {promptOption === 'custom' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: '8px' }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="w-full"
                                >
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        className="w-full h-36 rounded-lg border-2 border-neutral-600 bg-white/5 p-4 text-neutral-200 focus:border-yellow-400 focus:ring-yellow-400 focus:outline-none transition-colors"
                                        placeholder="e.g., A person wearing the product, skateboarding at sunset..."
                                        aria-label="Custom instructions for the AI model"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-8">
                    {appState === 'generating' ? (
                        <button
                            onClick={handleCancel}
                            className={`${primaryButtonClasses} !bg-red-600 hover:!bg-red-500`}
                        >
                            Cancel Generation
                        </button>
                    ) : (
                         <button
                            onClick={appState === 'error' ? handleReset : handleGenerate}
                            disabled={!productImage || !personImage}
                            className={primaryButtonClasses}
                        >
                            {appState === 'error' ? 'Try Again' : 'Generate Scene'}
                        </button>
                    )}
                </div>

                <AnimatePresence>
                {(appState === 'generating' || appState === 'results' || appState === 'error') && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-3xl aspect-square bg-white/5 rounded-lg border-2 border-neutral-800 flex items-center justify-center p-2 relative"
                        aria-live="polite"
                    >
                        {isLoading && (
                            <div className="flex flex-col items-center text-center text-neutral-400 p-4">
                                <svg className="animate-spin h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <p className="font-permanent-marker text-xl mt-4">{error || 'AI is creating your scene...'}</p>
                            </div>
                        )}
                        
                        {!isLoading && error && (
                            <div className="flex flex-col items-center text-center text-red-400 p-4">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="font-permanent-marker text-xl">{error}</p>
                            </div>
                        )}

                        {generatedImage && !isLoading && !error && (
                            <>
                                <img src={generatedImage} alt="Generated scene of a person using a product" className="w-full h-full object-contain rounded-md"/>
                                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/20 backdrop-blur-sm p-2 rounded-lg">
                                    <a href={generatedImage} download="ai-product-shoot.png" className="font-permanent-marker text-lg text-center text-black bg-yellow-400 py-2 px-6 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[1px_1px_0px_1px_rgba(0,0,0,0.2)]">Download</a>
                                    <button onClick={handleReset} className={secondaryButtonClasses}>Start Over</button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
            <Footer />
        </main>
    );
}

export default App;