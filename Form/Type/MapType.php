<?php
/**
 * @date   2017-10-05
 * @author webber, j63
 */

namespace CuriousInc\MapFormTypeBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\OptionsResolver\OptionsResolver;

/**
 * Class MapType
 *
 * @package CuriousInc\MapFormTypeBundle\Form\Type
 */
class MapType extends AbstractType
{

    protected const ALLOWED_FIELDS = [
        'longitude',
        'latitude',
        'address',
        'street',
        'postal_code',
        'city',
        'city_district',
        'city_neighbourhood',
        'state',
        'country',
    ];

    /**
     * {@inheritdoc}
     */
    public function configureOptions(OptionsResolver $resolver)
    {
        parent::configureOptions($resolver);

        $resolver->setDefaults(
            [
                'defaults'       => [
                    'longitude' => 4.82,
                    'latitude'  => 52.4,
                    'zoom'      => 12,
                ],
                'fields'         => [
                    'address'   => [],
                    'longitude' => [],
                    'latitude'  => [],
                ],
                'map_dimensions' => [
                    'width'  => '100%',
                    'height' => '400px',
                ],
                'translation_domain' => 'CuriousIncMapFormTypeBundle'
            ]
        );
    }

    /**
     * {@inheritdoc}
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        // Create configured fields
        $fields = $options['fields'];
        foreach ($fields as $fieldKey => $field) {

            // Skip unknown fields
            if ($field === null || !in_array($fieldKey, self::ALLOWED_FIELDS, true)) {
                continue;
            }

            // Determine properties
            $name    = $field['name'] ?? $fieldKey;
            $type    = $field['type'] ?? TextType::class;
            $options = $field['options'] ?? [];

            // Add field
            $builder->add($name, $type, $options);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function buildView(FormView $view, FormInterface $form, array $options)
    {
        $view->vars['defaults']       = $options['defaults'];
        $view->vars['fields']         = $options['fields'];
        $view->vars['map_dimensions'] = $options['map_dimensions'];
    }
}
